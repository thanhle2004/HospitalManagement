import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FlowStepsRepository } from './repositories/flow-steps.repository';
import { FlowsService } from './flows.service';
import { RoomTypesRepository } from '../room-types/room-types.repository';
import { CreateFlowStepDto } from './dto/create-flow-step.dto';
import { UpdateFlowStepDto } from './dto/update-flow-step.dto';

@Injectable()
export class FlowStepsService {
  constructor(
    private readonly flowStepsRepository: FlowStepsRepository,
    private readonly flowsService: FlowsService,
    private readonly roomTypesRepository: RoomTypesRepository,
  ) {}

  async create(flowId: number, dto: CreateFlowStepDto) {
    await this.flowsService.assertExists(flowId);

    const roomType = await this.roomTypesRepository.findById(dto.roomTypeId);
    if (!roomType) {
      throw new NotFoundException(`RoomType #${dto.roomTypeId} không tồn tại`);
    }

    const existing = await this.flowStepsRepository.findByFlowAndCode(
      flowId,
      dto.code,
    );
    if (existing) {
      throw new ConflictException(
        `Code "${dto.code}" đã tồn tại trong workflow này`,
      );
    }

    return this.flowStepsRepository.create({
      code: dto.code,
      displayOrder: dto.displayOrder,
      isOptional: dto.isOptional,
      flow: { connect: { id: flowId } },
      roomType: { connect: { id: dto.roomTypeId } },
    });
  }

  async update(flowId: number, stepId: number, dto: UpdateFlowStepDto) {
    const step = await this.assertBelongsToFlow(flowId, stepId);

    if (dto.roomTypeId) {
      const roomType = await this.roomTypesRepository.findById(dto.roomTypeId);
      if (!roomType) {
        throw new NotFoundException(`RoomType #${dto.roomTypeId} không tồn tại`);
      }
    }

    if (dto.code && dto.code !== step.code) {
      const existing = await this.flowStepsRepository.findByFlowAndCode(
        flowId,
        dto.code,
      );
      if (existing) {
        throw new ConflictException(
          `Code "${dto.code}" đã tồn tại trong workflow này`,
        );
      }
    }

    return this.flowStepsRepository.update(stepId, {
      code: dto.code,
      displayOrder: dto.displayOrder,
      isOptional: dto.isOptional,
      roomType: dto.roomTypeId
        ? { connect: { id: dto.roomTypeId } }
        : undefined,
    });
  }

  async remove(flowId: number, stepId: number): Promise<void> {
    await this.assertBelongsToFlow(flowId, stepId);
    // onDelete: Cascade ở schema tự xoá luôn FlowDependency liên quan
    await this.flowStepsRepository.delete(stepId);
  }

  /** Dùng nội bộ bởi FlowDependenciesService để xác nhận step tồn tại + đúng flow */
  async assertBelongsToFlow(flowId: number, stepId: number) {
    const step = await this.flowStepsRepository.findById(stepId);
    if (!step || step.flowId !== flowId) {
      throw new NotFoundException(
        `FlowStep #${stepId} không tồn tại trong Flow #${flowId}`,
      );
    }
    return step;
  }
}
