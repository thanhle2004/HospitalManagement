import { Injectable, Logger } from '@nestjs/common';
import { VisitsRepository } from '../../visits/repositories/visits.repository';
import { RoomRuntimeRepository } from '../../rooms/room-runtime.repository';
import { RoomQueueEntriesRepository } from '../../check-in/repositories/room-queue-entries.repository';
import { RoutingQueueRepository } from '../../visits/repositories/routing-queue.repository';
import { RoutingDecisionsRepository } from '../../routing/repositories/routing-decisions.repository';
import { SimulationViolationsRepository } from '../repositories/simulation-violations.repository';
import { evaluateSimulationAssertions } from './simulation-assertions';
import { SimulationSweepInput, SimulationViolationInput } from './simulation-sweep.types';

export interface SweepOptions {
  stuckThresholdMs?: number;
  routingMaxPendingMs?: number;
}

const DEFAULT_STUCK_THRESHOLD_MS = 30 * 60 * 1000;
const DEFAULT_ROUTING_MAX_PENDING_MS = 60 * 1000;

type SweepVisitGraphRow = {
  id: string;
  status: 'CREATED' | 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  steps: Array<{
    id: number;
    status:
      | 'LOCKED'
      | 'READY'
      | 'ASSIGNED'
      | 'CHECKED_IN'
      | 'IN_PROGRESS'
      | 'COMPLETED'
      | 'SKIPPED'
      | 'CANCELLED';
    updatedAt: Date;
    dependencies: Array<{ requiredStepId: number }>;
    assignments: Array<{
      id: number;
      roomId: number;
      status: 'WAITING' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    }>;
  }>;
};

/**
 * Lớp DUY NHẤT chạm DB trong nhóm "assertions" — evaluateSimulationAssertions()
 * (cùng thư mục) vẫn là hàm thuần, dễ test (33 test đã có, không cần DB).
 * Runner này chỉ có nhiệm vụ: fetch state hiện tại của 1 run -> map sang
 * SimulationSweepInput -> gọi hàm thuần -> ghi kết quả.
 *
 * KHÔNG unit-test được trong môi trường hiện tại (Prisma client chưa
 * generate được, xem ghi chú trong docs/simulator-architecture.md hoặc PR
 * description) — review kỹ bằng tay, đối chiếu chữ ký từng repository.
 */
@Injectable()
export class SimulationAssertionsRunner {
  private readonly logger = new Logger(SimulationAssertionsRunner.name);

  /** Trạng thái step ở lần sweep TRƯỚC, theo từng run — cần cho A3 (xem
   * evaluateSimulationAssertions). Runner này SỐNG SUỐT vòng đời ứng dụng
   * (NestJS singleton) nên PHẢI tự dọn qua clearRunState() khi 1 run kết
   * thúc, nếu không sẽ rò rỉ bộ nhớ dần qua nhiều run. */
  private readonly lastStepStatusesByRun = new Map<string, Map<number, string>>();
  private readonly stepStatusSinceByRun = new Map<
    string,
    Map<number, { status: string; sinceSimTimeMs: number }>
  >();
  private readonly routingStatusSinceByRun = new Map<
    string,
    Map<number, { status: string; sinceSimTimeMs: number }>
  >();
  private readonly activeViolationKeysByRun = new Map<string, Set<string>>();

  constructor(
    private readonly visitsRepository: VisitsRepository,
    private readonly roomRuntimeRepository: RoomRuntimeRepository,
    private readonly roomQueueEntriesRepository: RoomQueueEntriesRepository,
    private readonly routingQueueRepository: RoutingQueueRepository,
    private readonly routingDecisionsRepository: RoutingDecisionsRepository,
    private readonly simulationViolationsRepository: SimulationViolationsRepository,
  ) {}

  async sweep(
    runId: string,
    roomIds: number[],
    nowMs: number,
    options: SweepOptions = {},
  ): Promise<SimulationViolationInput[]> {
    const input = await this.buildSweepInput(runId, roomIds, nowMs, options);
    const previous = this.lastStepStatusesByRun.get(runId);

    const { violations, nextStepStatuses } = evaluateSimulationAssertions(input, previous);
    this.lastStepStatusesByRun.set(runId, nextStepStatuses);

    const previousViolationKeys = this.activeViolationKeysByRun.get(runId) ?? new Set<string>();
    const currentViolationKeys = new Set(violations.map((violation) => this.violationKey(violation)));
    const newViolations = violations.filter(
      (violation) => !previousViolationKeys.has(this.violationKey(violation)),
    );
    this.activeViolationKeysByRun.set(runId, currentViolationKeys);

    if (newViolations.length > 0) {
      this.logger.warn(`SimulationRun #${runId}: ${newViolations.length} vi phạm mới ở sweep t=${nowMs}ms`);
      await this.simulationViolationsRepository.createMany(runId, nowMs, newViolations);
    }

    return violations;
  }

  /** Gọi khi 1 run kết thúc (COMPLETED/STOPPED/FAILED) hoặc bị xoá — tránh
   * Map ở trên phình to vô hạn qua nhiều run trong suốt vòng đời ứng dụng. */
  clearRunState(runId: string): void {
    this.lastStepStatusesByRun.delete(runId);
    this.stepStatusSinceByRun.delete(runId);
    this.routingStatusSinceByRun.delete(runId);
    this.activeViolationKeysByRun.delete(runId);
  }

  private violationKey(violation: SimulationViolationInput): string {
    return [
      violation.rule,
      violation.visitId ?? '',
      violation.visitStepId ?? '',
      violation.roomId ?? '',
    ].join(':');
  }

  private async buildSweepInput(
    runId: string,
    roomIds: number[],
    nowMs: number,
    options: SweepOptions,
  ): Promise<SimulationSweepInput> {
    const visitsRaw = (await this.visitsRepository.findAllBySimulationRunWithGraph(
      runId,
    )) as SweepVisitGraphRow[];
    const allStepIds = visitsRaw.flatMap((v: SweepVisitGraphRow) =>
      v.steps.map((s: SweepVisitGraphRow['steps'][number]) => s.id),
    );

    const [roomRuntimes, queueEntriesRaw, routingQueueRaw, routingDecisionsRaw] =
      await Promise.all([
        this.roomRuntimeRepository.findAllByRoomIds(roomIds),
        this.roomQueueEntriesRepository.findAllByRoomsWithDetails(roomIds),
        this.routingQueueRepository.findAllByVisitStepIds(allStepIds),
        this.routingDecisionsRepository.findAllByVisitStepIds(allStepIds),
      ]);

    // DB updatedAt/enqueueAt are epoch wall-clock timestamps and cannot be
    // compared with the engine's zero-based simulation clock. Track the
    // first simulation timestamp at which each unchanged state was observed.
    const stepStatusSince = this.stepStatusSinceByRun.get(runId) ?? new Map();
    const seenStepIds = new Set<number>();
    for (const visit of visitsRaw) {
      for (const step of visit.steps) {
        seenStepIds.add(step.id);
        const previous = stepStatusSince.get(step.id);
        if (!previous || previous.status !== step.status) {
          stepStatusSince.set(step.id, {
            status: step.status,
            sinceSimTimeMs: nowMs,
          });
        }
      }
    }
    for (const stepId of stepStatusSince.keys()) {
      if (!seenStepIds.has(stepId)) stepStatusSince.delete(stepId);
    }
    this.stepStatusSinceByRun.set(runId, stepStatusSince);

    const routingStatusSince = this.routingStatusSinceByRun.get(runId) ?? new Map();
    const seenRoutingStepIds = new Set<number>();
    for (const entry of routingQueueRaw) {
      seenRoutingStepIds.add(entry.visitStepId);
      const previous = routingStatusSince.get(entry.visitStepId);
      if (!previous || previous.status !== entry.status) {
        routingStatusSince.set(entry.visitStepId, {
          status: entry.status,
          sinceSimTimeMs: nowMs,
        });
      }
    }
    for (const stepId of routingStatusSince.keys()) {
      if (!seenRoutingStepIds.has(stepId)) routingStatusSince.delete(stepId);
    }
    this.routingStatusSinceByRun.set(runId, routingStatusSince);

    return {
      nowMs,
      stuckThresholdMs: options.stuckThresholdMs ?? DEFAULT_STUCK_THRESHOLD_MS,
      routingMaxPendingMs: options.routingMaxPendingMs ?? DEFAULT_ROUTING_MAX_PENDING_MS,
      visits: visitsRaw.map((v: SweepVisitGraphRow) => ({
        id: v.id,
        status: v.status,
        steps: v.steps.map((s: SweepVisitGraphRow['steps'][number]) => ({
          id: s.id,
          status: s.status,
          updatedAtMs: stepStatusSince.get(s.id)?.sinceSimTimeMs ?? nowMs,
          dependsOnStepIds: s.dependencies.map(
            (d: { requiredStepId: number }) => d.requiredStepId,
          ),
          assignments: s.assignments.map((a: {
            id: number;
            roomId: number;
            status: 'WAITING' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
          }) => ({
            id: a.id,
            roomId: a.roomId,
            status: a.status,
          })),
        })),
      })),
      roomRuntimes: roomRuntimes.map((r) => ({
        roomId: r.roomId,
        currentVisitAssignmentId: r.currentVisitAssignmentId,
      })),
      // findAllByRoomsWithDetails() include sâu tới visitStep — xem
      // RoomQueueEntriesRepository (Phase 8) — .visitAssignment.visitStep.id
      // luôn tồn tại vì VisitAssignment.visitStep là quan hệ bắt buộc.
      queueEntries: queueEntriesRaw.map((e) => ({
        roomId: e.roomId,
        position: e.position,
        visitAssignmentId: e.visitAssignmentId,
        visitStepId: e.visitAssignment.visitStep.id,
      })),
      routingQueueEntries: routingQueueRaw.map((e) => ({
        visitStepId: e.visitStepId,
        status: e.status,
        enqueueAtMs:
          routingStatusSince.get(e.visitStepId)?.sinceSimTimeMs ?? nowMs,
      })),
      routingDecisions: routingDecisionsRaw.map((d) => ({
        visitStepId: d.visitStepId,
        selectedRoomId: d.selectedRoomId,
        // candidates được lưu ở Phase 3 dạng { roomId, ... }[] — xem
        // RoutingEngineService.recordDecision(). Nếu vì lý do gì đó cột này
        // không phải mảng (dữ liệu cũ trước Phase 3, hoặc lỗi ghi), coi như
        // "không rõ candidate nào đủ điều kiện" thay vì crash cả sweep.
        eligibleRoomIds: Array.isArray(d.candidates)
          ? (d.candidates as Array<{ roomId?: number }>)
              .map((c) => c.roomId)
              .filter((id): id is number => typeof id === 'number')
          : [],
      })),
    };
  }
}
