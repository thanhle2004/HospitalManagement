import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, VisitStatus, VisitStepStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitsRepository } from './repositories/visits.repository';
import { VisitStepsRepository } from './repositories/visit-steps.repository';
import { VisitStepDependenciesRepository } from './repositories/visit-step-dependencies.repository';
import { RoutingQueueRepository } from './repositories/routing-queue.repository';
import { VisitsMapper } from './visits.mapper';
import { FlowsRepository } from '../flows/repositories/flows.repository';
import { RoomTypesRepository } from '../room-types/room-types.repository';
import { CreateVisitDto } from './dto/create-visit.dto';
import { AddAdHocStepDto } from './dto/add-ad-hoc-step.dto';
import { VisitResponseDto } from './dto/visit-response.dto';
import { VisitDetailResponseDto } from './dto/visit-detail-response.dto';
import { findReadyNodes } from '../../common/utils/graph.util';
import { VISIT_STEP_READY_EVENT, VisitStepReadyEvent } from './events/visit-step-ready.event';
import { VISIT_UPDATED_EVENT, VisitUpdatedEvent } from './events/visit-updated.event';

/** 3 trạng thái coi là "đã xử lý xong" đối với dependency resolution lẫn kiểm tra Visit hoàn tất */
const RESOLVED_STEP_STATUSES: VisitStepStatus[] = [
  VisitStepStatus.COMPLETED,
  VisitStepStatus.SKIPPED,
  VisitStepStatus.CANCELLED,
];

@Injectable()
export class VisitsService {
  constructor(
    private readonly visitsRepository: VisitsRepository,
    private readonly visitStepsRepository: VisitStepsRepository,
    private readonly visitStepDependenciesRepository: VisitStepDependenciesRepository,
    private readonly routingQueueRepository: RoutingQueueRepository,
    private readonly flowsRepository: FlowsRepository,
    private readonly roomTypesRepository: RoomTypesRepository,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Hiện thực §7 Bước 1-3 của spec:
   *  1. Tạo Visit mới
   *  2. Copy Flow (FlowStep + FlowDependency) thành VisitStep + VisitStepDependency runtime
   *  3. Xác định các VisitStep đủ điều kiện (READY) bằng Kahn's algorithm, đẩy vào RoutingQueue
   * Toàn bộ nằm trong 1 Unit of Work — lỗi ở bất kỳ bước nào thì rollback
   * sạch, không để lại Visit "mồ côi" thiếu step hoặc thiếu routing queue.
   */
  async create(
    patientId: string,
    dto: CreateVisitDto,
  ): Promise<VisitDetailResponseDto> {
    const flowGraph = await this.flowsRepository.findByIdWithGraph(dto.flowId);
    if (!flowGraph) {
      throw new NotFoundException(`Flow #${dto.flowId} không tồn tại`);
    }
    if (flowGraph.steps.length === 0) {
      throw new BadRequestException(
        'Workflow chưa có bước khám nào — không thể tạo Visit',
      );
    }

    const { visitId, readyStepIds } = await this.prisma.transaction(
      async (tx) => {
        const visit = await this.visitsRepository.create(
          {
            patient: { connect: { id: patientId } },
            flow: { connect: { id: dto.flowId } },
            status: VisitStatus.CREATED,
          },
          tx,
        );

        // 1. Copy từng FlowStep -> VisitStep, giữ lại mapping flowStepId -> visitStepId
        //    (tạo tuần tự từng dòng vì cần lấy id mới sinh ra — createMany của
        //    MySQL không trả về id, không dùng được ở đây).
        const flowStepIdToVisitStepId = new Map<number, number>();
        for (const flowStep of flowGraph.steps) {
          const visitStep = await this.visitStepsRepository.create(
            {
              visit: { connect: { id: visit.id } },
              flowStep: { connect: { id: flowStep.id } },
              roomType: { connect: { id: flowStep.roomTypeId } },
              displayOrder: flowStep.displayOrder,
              isOptional: flowStep.isOptional,
              status: VisitStepStatus.LOCKED, // cập nhật lại READY bên dưới
            },
            tx,
          );
          flowStepIdToVisitStepId.set(flowStep.id, visitStep.id);
        }

        // 2. Copy FlowDependency -> VisitStepDependency, map sang id VisitStep mới
        const dependencyRows = flowGraph.steps.flatMap((flowStep) =>
          flowStep.dependencies.map((dep) => ({
            stepId: flowStepIdToVisitStepId.get(dep.stepId)!,
            requiredStepId: flowStepIdToVisitStepId.get(dep.requiredStepId)!,
          })),
        );
        await this.visitStepDependenciesRepository.createMany(
          dependencyRows,
          tx,
        );

        // 3. Kahn's algorithm: node = VisitStep.id mới, edge = { from: requiredStepId, to: stepId }
        //    (giống hệt cách dùng ở FlowDependenciesService, chỉ khác node là VisitStep)
        const nodes = Array.from(flowStepIdToVisitStepId.values());
        const edges = dependencyRows.map((d) => ({
          from: d.requiredStepId,
          to: d.stepId,
        }));
        const readyStepIds = findReadyNodes(nodes, edges, new Set());

        await this.visitStepsRepository.updateManyStatus(
          readyStepIds,
          VisitStepStatus.READY,
          tx,
        );
        await this.routingQueueRepository.enqueueMany(readyStepIds, tx);

        // 4. Visit chính thức bước vào hàng đợi routing
        await this.visitsRepository.updateStatus(
          visit.id,
          VisitStatus.WAITING,
          { startedAt: new Date() },
          tx,
        );

        return { visitId: visit.id, readyStepIds };
      },
    );

    this.emitReadyEvents(readyStepIds);
    this.emitVisitUpdated(visitId);

    return this.findDetailById(visitId, patientId);
  }

  async findAllByPatient(patientId: string): Promise<VisitResponseDto[]> {
    const visits = await this.visitsRepository.findAllByPatient(patientId);
    return VisitsMapper.toResponseDtoList(visits);
  }

  async findAll(): Promise<VisitResponseDto[]> {
    const visits = await this.visitsRepository.findAll();
    return VisitsMapper.toResponseDtoList(visits);
  }

  /**
   * `ownerPatientId` khác null => bắt buộc Visit phải thuộc đúng patient đó
   * (dùng cho route self-service của Patient). Staff xem bất kỳ Visit nào
   * thì gọi với `ownerPatientId = null`.
   */
  async findDetailById(
    id: string,
    ownerPatientId: string | null,
  ): Promise<VisitDetailResponseDto> {
    const visit = await this.visitsRepository.findByIdWithGraph(id);
    if (!visit) {
      throw new NotFoundException(`Visit #${id} không tồn tại`);
    }
    if (ownerPatientId && visit.patientId !== ownerPatientId) {
      throw new ForbiddenException('Visit này không thuộc về bạn');
    }
    return VisitsMapper.toDetailResponseDto(visit);
  }

  /**
   * [Doctor] §4 "chỉ định thêm bước khám" — tạo VisitStep ad-hoc (isAdHoc=true,
   * không gắn với FlowStep nào). Không cần kiểm tra cycle: node mới chỉ có
   * thể nhận cạnh ĐI VÀO từ các step đã tồn tại (dependsOn), không step nào
   * khác có thể phụ thuộc ngược lại 1 node vừa mới tạo — về mặt toán học
   * không thể tạo chu trình trong tình huống này.
   */
  async addAdHocStep(
    visitId: string,
    dto: AddAdHocStepDto,
  ): Promise<VisitDetailResponseDto> {
    const visit = await this.visitsRepository.findById(visitId);
    if (!visit) {
      throw new NotFoundException(`Visit #${visitId} không tồn tại`);
    }
    if (
      visit.status === VisitStatus.COMPLETED ||
      visit.status === VisitStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Visit đã kết thúc — không thể điều chỉnh Workflow',
      );
    }

    const roomType = await this.roomTypesRepository.findById(dto.roomTypeId);
    if (!roomType) {
      throw new NotFoundException(`RoomType #${dto.roomTypeId} không tồn tại`);
    }

    const allSteps = await this.visitStepsRepository.findAllByVisit(visitId);
    const allStepIds = new Set(allSteps.map((s) => s.id));
    for (const depId of dto.dependsOn) {
      if (!allStepIds.has(depId)) {
        throw new BadRequestException(
          `VisitStep #${depId} không thuộc Visit #${visitId}`,
        );
      }
    }

    const dependsOnSteps = allSteps.filter((s) => dto.dependsOn.includes(s.id));
    const allDependenciesResolved = dependsOnSteps.every((s) =>
      RESOLVED_STEP_STATUSES.includes(s.status),
    );
    const initialStatus =
      dto.dependsOn.length === 0 || allDependenciesResolved
        ? VisitStepStatus.READY
        : VisitStepStatus.LOCKED;

    const newStepId = await this.prisma.transaction(async (tx) => {
      const newStep = await this.visitStepsRepository.create(
        {
          visit: { connect: { id: visitId } },
          roomType: { connect: { id: dto.roomTypeId } },
          isAdHoc: true,
          isOptional: dto.isOptional,
          displayOrder: allSteps.length,
          status: initialStatus,
        },
        tx,
      );

      if (dto.dependsOn.length > 0) {
        await this.visitStepDependenciesRepository.createMany(
          dto.dependsOn.map((requiredStepId) => ({
            stepId: newStep.id,
            requiredStepId,
          })),
          tx,
        );
      }

      if (initialStatus === VisitStepStatus.READY) {
        await this.routingQueueRepository.enqueueMany([newStep.id], tx);
      }

      return newStep.id;
    });

    if (initialStatus === VisitStepStatus.READY) {
      this.emitReadyEvents([newStepId]);
    }
    this.emitVisitUpdated(visitId);

    return this.findDetailById(visitId, null);
  }

  /**
   * [Doctor] §4 "loại bỏ bước khám" — chỉ cho phép skip bước TUỲ CHỌN
   * (isOptional=true) và CHƯA được Routing Engine gán phòng (LOCKED/READY).
   * Một khi đã ASSIGNED (đã có QR cho bệnh nhân), việc rút lại cần quy
   * trình can thiệp thủ công đầy đủ hơn (ghi ActivityLog, huỷ VisitAssignment
   * ở RoutingModule) — nằm ngoài phạm vi Phase 8, để dành cho Phase 10.
   */
  async skipStep(visitId: string, stepId: number): Promise<VisitDetailResponseDto> {
    const step = await this.visitStepsRepository.findById(stepId);
    if (!step || step.visitId !== visitId) {
      throw new NotFoundException(
        `VisitStep #${stepId} không tồn tại trong Visit #${visitId}`,
      );
    }
    if (!step.isOptional) {
      throw new BadRequestException(
        'Chỉ có thể bỏ qua (skip) bước khám tuỳ chọn (isOptional=true)',
      );
    }
    const skippable: VisitStepStatus[] = [
      VisitStepStatus.LOCKED,
      VisitStepStatus.READY,
    ];
    if (!skippable.includes(step.status)) {
      throw new ConflictException(
        `Không thể skip step đang ở trạng thái ${step.status} (đã được gán phòng hoặc đã xử lý)`,
      );
    }

    const readyStepIds = await this.prisma.transaction(async (tx) => {
      await this.visitStepsRepository.updateStatus(
        stepId,
        VisitStepStatus.SKIPPED,
        {},
        tx,
      );
      // Step đang READY nghĩa là đã có RoutingQueue entry chờ xử lý — dọn đi
      await this.routingQueueRepository.deleteIfExists(stepId, tx);

      return this.resolveDependenciesAndCheckCompletion(visitId, tx);
    });

    this.emitReadyEvents(readyStepIds);
    this.emitVisitUpdated(visitId);

    return this.findDetailById(visitId, null);
  }

  /**
   * Dùng chung bởi `skipStep()` ở trên VÀ DoctorModule (khi 1 VisitAssignment
   * chuyển COMPLETED) — §7 Bước 8: "kiểm tra các quan hệ phụ thuộc để xác
   * định bước tiếp theo". Nhận `tx` từ transaction của CALLER (không tự mở
   * transaction riêng) để đảm bảo cùng 1 Unit of Work với hành động gốc.
   * Trả về danh sách visitStepId vừa chuyển READY — caller tự emit event
   * SAU KHI transaction của chính họ commit xong.
   */
  async resolveDependenciesAndCheckCompletion(
    visitId: string,
    tx: Prisma.TransactionClient,
  ): Promise<number[]> {
    const [allSteps, allDependencies] = await Promise.all([
      this.visitStepsRepository.findAllByVisit(visitId, tx),
      this.visitStepDependenciesRepository.findAllByVisit(visitId, tx),
    ]);

    const resolvedIds = new Set(
      allSteps
        .filter((s) => RESOLVED_STEP_STATUSES.includes(s.status))
        .map((s) => s.id),
    );
    const lockedIds = new Set(
      allSteps.filter((s) => s.status === VisitStepStatus.LOCKED).map((s) => s.id),
    );

    const nodes = allSteps.map((s) => s.id);
    const edges = allDependencies.map((d) => ({
      from: d.requiredStepId,
      to: d.stepId,
    }));
    const newlyReady = findReadyNodes(nodes, edges, resolvedIds).filter((id) =>
      lockedIds.has(id),
    );

    if (newlyReady.length > 0) {
      await this.visitStepsRepository.updateManyStatus(
        newlyReady,
        VisitStepStatus.READY,
        tx,
      );
      await this.routingQueueRepository.enqueueMany(newlyReady, tx);
    }

    // Visit hoàn tất khi MỌI step đều đã resolved (kể cả step vừa chuyển READY thì chưa tính resolved)
    const allResolved = allSteps.every((s) =>
      newlyReady.includes(s.id) ? false : RESOLVED_STEP_STATUSES.includes(s.status),
    );
    if (allResolved) {
      await this.visitsRepository.updateStatus(
        visitId,
        VisitStatus.COMPLETED,
        { completedAt: new Date() },
        tx,
      );
    }

    return newlyReady;
  }

  /**
   * Emit SAU KHI transaction đã commit — nếu emit bên trong transaction,
   * RoutingEngineService (lắng nghe event) có thể đọc phải dữ liệu chưa
   * commit hoặc bị lock chờ transaction hiện tại, tạo deadlock tiềm ẩn.
   */
  private emitReadyEvents(visitStepIds: number[]): void {
    for (const visitStepId of visitStepIds) {
      this.eventEmitter.emit(
        VISIT_STEP_READY_EVENT,
        new VisitStepReadyEvent(visitStepId),
      );
    }
  }

  /** [Phase 9] Báo RealtimeGateway push cập nhật cho Patient đang theo dõi Visit này qua WebSocket */
  private emitVisitUpdated(visitId: string): void {
    this.eventEmitter.emit(VISIT_UPDATED_EVENT, new VisitUpdatedEvent(visitId));
  }
}
