import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SimulationMode, SimulationRunStatus } from '@prisma/client';
import { SimulationRunsRepository } from '../repositories/simulation-runs.repository';
import { SimulationEventsRepository } from '../repositories/simulation-events.repository';
import { SimulationFixturesService } from '../fixtures/simulation-fixtures.service';
import { ProvisionedPatientFixture } from '../fixtures/simulation-fixtures.types';
import { SimulationActorsFactory } from '../actors/simulation-actors.factory';
import { buildRoomFixtureMaps, PatientFlowEventType, PatientFlowPayload } from '../actors/patient-flow-events';
import { SimulationEngine, SimulationEngineStopReason } from '../engine/simulation-engine';
import { SimulationSpeed } from '../engine/simulation-clock';
import { MetricsCollector, MetricsSnapshot } from '../metrics/metrics-collector';
import { SimulationEventBuffer } from '../metrics/simulation-event-buffer';
import { SimulationAssertionsRunner } from '../metrics/simulation-assertions.runner';
import { SimulationViolationsRepository } from '../repositories/simulation-violations.repository';
import { diffSimulationOutcomes, OutcomeDiff, SimulationOutcomeSummary } from '../metrics/outcome-diff';
import { SimulationGateway } from './simulation.gateway';
import { CreateSimulationRunInput } from './simulation-run-config.types';
import { VisitsRepository } from '../../visits/repositories/visits.repository';
import { RoomsRepository } from '../../rooms/rooms.repository';
import { resolveSimulationServiceTimeSeconds } from './simulation-service-time';
import { SimulationRoomLeasesRepository } from '../repositories/simulation-room-leases.repository';

type RunEngine = SimulationEngine<PatientFlowEventType, PatientFlowPayload>;

interface ActiveRun {
  engine: RunEngine;
  metricsCollector: MetricsCollector;
  eventBuffer: SimulationEventBuffer;
  roomIds: number[];
  /** [Phase 6] Giữ lại config đã đọc từ DB lúc start — Frontend cần
   * config.rooms để vẽ Hospital Board, và getActiveSnapshot() không nên
   * bắt Controller phải tự query lại SimulationRun chỉ để lấy field này. */
  config: CreateSimulationRunInput;
}

export interface SimulationRunSnapshot {
  status: SimulationRunStatus;
  simTimeMs: number;
  processedEventCount: number;
  pendingEventCount: number;
  metrics: MetricsSnapshot;
  config: CreateSimulationRunInput;
  roomState: SimulationRoomState[];
  patientLocations: SimulationPatientLocation[];
}

export interface SimulationPatientLocation {
  patientId: string;
  patientName: string;
  visitId: string;
  visitStepId: number;
  stepDisplayOrder: number;
  currentStep: string;
  currentRoom: string | null;
  status: string;
}

export interface SimulationRoomState {
  roomId: number;
  roomNumber: string;
  name: string;
  roomType: string;
  roomStatus: string;
  avgProcessTimeSeconds: number;
  examiningCount: number;
  waitingCount: number;
  estimatedWaitingSeconds: number;
  currentPatient: {
    patientId: string;
    patientName: string;
    visitId: string;
    visitStepId: number;
    currentStep: string;
    status: string;
  } | null;
  queue: Array<{
    position: number;
    patientId: string;
    patientName: string;
    visitId: string;
    visitStepId: number;
    status: string;
  }>;
}

/**
 * SimulationOrchestrator (xem docs/simulator-architecture.md §4, §13) —
 * "Chỉ orchestrate — không chứa bất kỳ logic nghiệp vụ bệnh viện nào".
 *
 * Giữ 1 SỔ ĐĂNG KÝ (registry) các run ĐANG CHẠY trong bộ nhớ (`activeRuns`)
 * — cần thiết vì 1 run headless chạy xuyên suốt nhiều request HTTP (tạo ->
 * start -> nhiều lần GET status trong lúc chạy -> stop/kết thúc). Registry
 * chỉ giữ run ĐANG RUNNING; sau khi xong (COMPLETED/STOPPED/FAILED), entry
 * bị xoá khỏi registry — muốn xem lại thì đọc SimulationRun/SimulationEvent/
 * SimulationViolation trong DB (đã ghi tại thời điểm chạy), không hỏi lại
 * orchestrator.
 *
 * "Headless" (mặc định — clockPolicy 'ASAP', xem CreateSimulationRunInput)
 * nghĩa là chạy hết tốc lực để lấy số liệu, không ai xem trực tiếp; đa số
 * Scenario chạy để nghiên cứu dùng chế độ này (Phase 4). [Phase 6] Đặt
 * clockPolicy 'PACED' hoặc 'STEP' để xem TRỰC TIẾP trên Admin UI — khi đó
 * pause/resume/step/setSpeed có tác dụng thấy được, và orchestrator đẩy
 * snapshot qua SimulationGateway (throttle ≤4/s, xem pushLiveSnapshotIfDue()).
 */
@Injectable()
export class SimulationOrchestratorService {
  private readonly logger = new Logger(SimulationOrchestratorService.name);
  private readonly activeRuns = new Map<string, ActiveRun>();
  private readonly startingRuns = new Set<string>();

  constructor(
    private readonly simulationRunsRepository: SimulationRunsRepository,
    private readonly simulationFixturesService: SimulationFixturesService,
    private readonly simulationActorsFactory: SimulationActorsFactory,
    private readonly simulationAssertionsRunner: SimulationAssertionsRunner,
    private readonly simulationEventsRepository: SimulationEventsRepository,
    private readonly simulationViolationsRepository: SimulationViolationsRepository,
    private readonly simulationGateway: SimulationGateway,
    private readonly visitsRepository: VisitsRepository,
    private readonly roomsRepository: RoomsRepository,
    private readonly simulationRoomLeasesRepository: SimulationRoomLeasesRepository,
  ) {}

  async createRun(input: CreateSimulationRunInput): Promise<string> {
    const run = await this.simulationRunsRepository.create({
      name: input.name,
      mode: input.mode === 'CONCURRENT' ? SimulationMode.CONCURRENT : SimulationMode.LOCKSTEP,
      seed: input.seed,
      config: input as unknown as Prisma.InputJsonValue,
    });
    return run.id;
  }

  /**
   * [Phase 5] Chạy CÙNG 1 scenario (cùng seed) 2 LẦN — 1 LOCKSTEP, 1
   * CONCURRENT — rồi so khác biệt kết quả cuối cùng (A13, §3.1). Bất kỳ
   * khác biệt nào ở đây, theo định nghĩa, chỉ có thể do race condition gây
   * ra, vì input 2 lần chạy giống hệt nhau.
   *
   * Chạy TUẦN TỰ (đợi lần 1 xong hẳn mới bắt đầu lần 2) — có chủ đích: giữ
   * 2 lần chạy hoàn toàn tách biệt tài nguyên (không để race của chính việc
   * SO SÁNH lẫn vào race đang muốn đo). `input.mode` (nếu có) bị BỎ QUA —
   * hàm này tự quyết định mode cho từng lần chạy.
   */
  async compareLockstepVsConcurrent(
    input: Omit<CreateSimulationRunInput, 'mode'>,
  ): Promise<{ lockstepRunId: string; concurrentRunId: string; diff: OutcomeDiff }> {
    const lockstepRunId = await this.createRun({ ...input, mode: 'LOCKSTEP' });
    await this.runHeadless(lockstepRunId);

    const concurrentRunId = await this.createRun({ ...input, mode: 'CONCURRENT' });
    await this.runHeadless(concurrentRunId);

    const [lockstepOutcome, concurrentOutcome] = await Promise.all([
      this.loadOutcomeSummary(lockstepRunId),
      this.loadOutcomeSummary(concurrentRunId),
    ]);

    return {
      lockstepRunId,
      concurrentRunId,
      diff: diffSimulationOutcomes(lockstepOutcome, concurrentOutcome),
    };
  }

  private async loadOutcomeSummary(runId: string): Promise<SimulationOutcomeSummary> {
    const [run, violations] = await Promise.all([
      this.simulationRunsRepository.findById(runId),
      this.simulationViolationsRepository.findAllByRun(runId),
    ]);
    const metrics = (run?.summary as unknown as MetricsSnapshot | null) ?? undefined;

    const violationCountsByRule: Record<string, number> = {};
    for (const v of violations) {
      violationCountsByRule[v.rule] = (violationCountsByRule[v.rule] ?? 0) + 1;
    }
    const perRoom: SimulationOutcomeSummary['perRoom'] = {};
    for (const [roomId, roomMetrics] of Object.entries(metrics?.perRoom ?? {})) {
      perRoom[Number(roomId)] = { patientsServed: roomMetrics.patientsServed };
    }

    return {
      visitsCompleted: metrics?.counters.visitsCompleted ?? 0,
      noShows: metrics?.counters.noShows ?? 0,
      violationCountsByRule,
      perRoom,
    };
  }

  /**
   * Bắt đầu chạy — trả về NGAY (không đợi run xong). Đây là lựa chọn có chủ
   * đích: 1 scenario 500 bệnh nhân có thể chạy hàng chục giây tới vài phút
   * ngay cả ở ASAP, giữ HTTP request mở suốt thời gian đó là không hợp lý.
   * Người gọi theo dõi tiến độ qua getSnapshot()/GET .../runs/:id.
   */
  async startRun(runId: string): Promise<void> {
    if (this.activeRuns.has(runId) || this.startingRuns.has(runId)) {
      throw new ConflictException(`SimulationRun #${runId} đang chạy rồi`);
    }
    this.startingRuns.add(runId);
    const run = await this.simulationRunsRepository.findById(runId);
    if (!run) {
      this.startingRuns.delete(runId);
      throw new NotFoundException(`SimulationRun #${runId} không tồn tại`);
    }
    const config = run.config as unknown as CreateSimulationRunInput;
    try {
      await this.simulationRoomLeasesRepository.acquire(
        runId,
        config.rooms.map((room) => room.roomId),
      );
    } catch (error) {
      this.startingRuns.delete(runId);
      throw error;
    }
    void this.runHeadless(runId, true).catch((err) => {
      this.logger.error(
        `SimulationRun #${runId}: lỗi không bắt được trong runHeadless(): ${err instanceof Error ? err.message : err}`,
      );
    }).finally(() => {
      this.startingRuns.delete(runId);
    });
  }

  stopRun(runId: string): void {
    const active = this.activeRuns.get(runId);
    if (!active) {
      throw new NotFoundException(`SimulationRun #${runId} hiện không chạy`);
    }
    active.engine.stop();
  }

  /** [Phase 6] Tạm dừng — chỉ có tác dụng thấy được nếu run đang PACED/STEP
   * (ASAP chạy hết tốc lực, "tạm dừng" giữa 2 sự kiện ASAP gần như không có
   * ý nghĩa thời gian thực vì khoảng cách giữa chúng đã bằng 0 sẵn). */
  pauseRun(runId: string): void {
    this.getActiveEngineOrThrow(runId).pause();
  }

  resumeRun(runId: string): void {
    this.getActiveEngineOrThrow(runId).resume();
  }

  /** [Phase 6] Chỉ có tác dụng khi clock đang ở policy STEP. */
  stepRun(runId: string): void {
    this.getActiveEngineOrThrow(runId).step();
  }

  setRunSpeed(runId: string, speed: SimulationSpeed): void {
    this.getActiveEngineOrThrow(runId).setSpeed(speed);
  }

  private getActiveEngineOrThrow(runId: string): RunEngine {
    const active = this.activeRuns.get(runId);
    if (!active) {
      throw new NotFoundException(`SimulationRun #${runId} hiện không chạy`);
    }
    return active.engine;
  }

  /** null nếu run không (còn) chạy trong bộ nhớ — GỌI GET /runs/:id ở tầng
   * Controller để lấy trạng thái CUỐI CÙNG từ DB cho trường hợp đó (đã
   * COMPLETED/STOPPED/FAILED và bị dọn khỏi registry). */
  async getActiveSnapshot(runId: string): Promise<SimulationRunSnapshot | null> {
    const active = this.activeRuns.get(runId);
    if (!active) return null;
    const runtime = await this.buildRuntimeState(runId, active.roomIds);
    return {
      status: this.mapEngineStatusToRunStatus(active.engine.status),
      simTimeMs: active.engine.clock.now,
      processedEventCount: active.engine.processedEventCount,
      pendingEventCount: active.engine.pendingEventCount,
      metrics: active.metricsCollector.snapshot(),
      config: active.config,
      ...runtime,
    };
  }

  async getRuntimeStateForRun(
    runId: string,
    roomIds: number[],
  ): Promise<Pick<SimulationRunSnapshot, 'roomState' | 'patientLocations'>> {
    return this.buildRuntimeState(runId, roomIds);
  }

  private async runHeadless(runId: string, leaseAlreadyAcquired = false): Promise<void> {
    let leaseAcquired = leaseAlreadyAcquired;
    try {
      const run = await this.simulationRunsRepository.findById(runId);
      if (!run) throw new NotFoundException(`SimulationRun #${runId} không tồn tại`);
      const config = run.config as unknown as CreateSimulationRunInput;
      if (!leaseAcquired) {
        await this.simulationRoomLeasesRepository.acquire(
          runId,
          config.rooms.map((room) => room.roomId),
        );
        leaseAcquired = true;
      }
      await this.executeRunWithLease(runId, config);
    } catch (error) {
      await this.simulationRunsRepository
        .updateStatus(runId, SimulationRunStatus.FAILED, { finishedAt: new Date() })
        .catch(() => undefined);
      throw error;
    } finally {
      if (leaseAcquired) {
        await this.simulationRoomLeasesRepository.releaseByRun(runId);
      }
    }
  }

  private async executeRunWithLease(
    runId: string,
    config: CreateSimulationRunInput,
  ): Promise<void> {

    await this.simulationRunsRepository.updateStatus(runId, SimulationRunStatus.PREPARING);

    const fixtures = await this.simulationFixturesService.provisionFixtures(runId, {
      patientCount: config.patientCount,
      rooms: config.rooms.map((r) => ({
        roomId: r.roomId,
        withDoctor: r.withDoctor,
        withDevice: r.withDevice,
      })),
    });
    const { roomIdToDeviceId, roomIdToDoctorId } = buildRoomFixtureMaps(fixtures.rooms);

    const patientGenerator = this.simulationActorsFactory.createPatientGenerator(roomIdToDeviceId, {
      simulationRunId: runId,
      noShowProbability: config.noShowProbability,
    });
    const configuredRooms = await Promise.all(
      config.rooms.map(async (r) => ({ config: r, room: await this.roomsRepository.findById(r.roomId) })),
    );
    const serviceTimeByRoom = new Map(
      configuredRooms.map(({ config: roomConfig, room }) => ({
        roomId: roomConfig.roomId,
        serviceTime: {
          meanSeconds:
            roomConfig.useRoomTypeAvgProcessTime !== false && room
              ? resolveSimulationServiceTimeSeconds(
                  room.avgProcessTime,
                  room.roomType.avgProcessTime,
                  roomConfig.serviceTimeMeanSeconds,
                  roomConfig.useRoomTypeAvgProcessTime,
                )
              : roomConfig.serviceTimeMeanSeconds,
          stdDevSeconds: roomConfig.serviceTimeStdDevSeconds,
        },
      })).map(({ roomId, serviceTime }) => [roomId, serviceTime]),
    );
    const doctorSimulator = this.simulationActorsFactory.createDoctorSimulator(
      roomIdToDoctorId,
      serviceTimeByRoom,
    );

    const isLive = (config.clockPolicy ?? 'ASAP') !== 'ASAP';
    const engine: RunEngine = new SimulationEngine({
      seed: config.seed,
      mode: config.mode ?? 'LOCKSTEP',
      concurrencyLimit: config.concurrencyLimit,
      clock: { policy: config.clockPolicy ?? 'ASAP', speed: config.speed },
    });
    patientGenerator.register(engine);
    doctorSimulator.register(engine);

    const metricsCollector = new MetricsCollector();
    const eventBuffer = new SimulationEventBuffer();
    // [Phase 6] Throttle thủ công ≤4/s bằng mốc thời gian THẬT (không phải
    // simTimeMs — người xem quan tâm "mỗi giây có gì mới trên màn hình",
    // không phải nhịp mô phỏng) — chỉ áp dụng khi có người XEM (isLive).
    let lastLivePushAtRealMs = 0;
    const LIVE_PUSH_INTERVAL_REAL_MS = 250;
    engine.onEveryEvent((event) => {
      metricsCollector.recordEvent(event);
      eventBuffer.push({
        simTimeMs: event.simTimeMs,
        seq: event.seq,
        type: event.type,
        visitId: event.visitId,
        visitStepId: event.visitStepId,
        roomId: event.roomId,
        payload: event.payload,
      });
      if (eventBuffer.shouldFlush()) {
        void this.flushEvents(runId, eventBuffer);
      }
      if (isLive) {
        const nowRealMs = Date.now();
        if (nowRealMs - lastLivePushAtRealMs >= LIVE_PUSH_INTERVAL_REAL_MS) {
          lastLivePushAtRealMs = nowRealMs;
          void this.buildRuntimeState(runId, roomIds).then((runtime) => {
            this.simulationGateway.emitSnapshot(runId, {
              status: this.mapEngineStatusToRunStatus(engine.status),
              simTimeMs: engine.clock.now,
              processedEventCount: engine.processedEventCount,
              pendingEventCount: engine.pendingEventCount,
              metrics: metricsCollector.snapshot(),
              config,
              ...runtime,
            });
          });
        }
      }
    });

    const roomIds = config.rooms.map((r) => r.roomId);
    const sweepOptions = {
      stuckThresholdMs: config.stuckThresholdMs,
      routingMaxPendingMs: config.routingMaxPendingMs,
    };
    const assertionSweepIntervalMs = config.assertionSweepIntervalMs ?? 5_000;

    // ASSERTION_SWEEP tự lên lịch lại chính nó — NHƯNG dừng hẳn khi mọi
    // bệnh nhân đã tới đích cuối (COMPLETED hoặc NO_SHOW), để không chặn
    // hàng đợi của engine rỗng lại (nếu không LOCKSTEP sẽ không bao giờ
    // COMPLETED — xem lý do tương tự cho DOCTOR_POLL ở patient-flow-events.ts).
    engine.on('ASSERTION_SWEEP', async (event, ctx) => {
      await this.simulationAssertionsRunner.sweep(runId, roomIds, event.simTimeMs, sweepOptions);
      const snapshot = metricsCollector.snapshot();
      const everyoneAccountedFor =
        snapshot.counters.visitsCompleted + snapshot.counters.noShows >= config.patientCount;
      if (!everyoneAccountedFor) {
        ctx.schedule({ simTimeMs: ctx.now + assertionSweepIntervalMs, type: 'ASSERTION_SWEEP' });
      }
    });
    engine.schedule({ simTimeMs: 0, type: 'ASSERTION_SWEEP' });

    this.scheduleArrivals(engine, fixtures.patients, config);

    this.activeRuns.set(runId, { engine, metricsCollector, eventBuffer, roomIds, config });
    await this.simulationRunsRepository.updateStatus(runId, SimulationRunStatus.RUNNING, {
      startedAt: new Date(),
    });

    let stopReason: SimulationEngineStopReason | 'FAILED_TO_RUN' = 'FAILED_TO_RUN';
    try {
      stopReason = await engine.run();
    } catch (err) {
      this.logger.error(
        `SimulationRun #${runId}: engine.run() ném lỗi: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      await this.flushEvents(runId, eventBuffer);
      // Sweep cuối cùng, ngoài chu kỳ định kỳ — không được phép bỏ lỡ vi
      // phạm xảy ra đúng lúc run vừa dừng.
      await this.simulationAssertionsRunner
        .sweep(runId, roomIds, engine.clock.now, sweepOptions)
        .catch((err) => {
          this.logger.error(`Sweep cuối cùng thất bại cho run #${runId}: ${err}`);
        });
      this.simulationAssertionsRunner.clearRunState(runId);
      this.activeRuns.delete(runId);
    }

    const finalStatus = this.mapStopReasonToRunStatus(stopReason);
    await this.simulationRunsRepository.updateStatus(runId, finalStatus, {
      finishedAt: new Date(),
      simEndTimeMs: engine.clock.now,
      summary: metricsCollector.snapshot() as unknown as Prisma.InputJsonValue,
    });
    if (isLive) {
      this.simulationGateway.emitFinished(runId, finalStatus);
    }
  }

  private scheduleArrivals(
    engine: RunEngine,
    patients: readonly ProvisionedPatientFixture[],
    config: CreateSimulationRunInput,
  ): void {
    patients.forEach((patient, index) => {
      const arrivalSimTimeMs =
        config.arrival.kind === 'BURST'
          ? (config.arrival.atMs ?? 0)
          : index * config.arrival.intervalMs;
      engine.schedule({
        simTimeMs: arrivalSimTimeMs,
        type: 'PATIENT_ARRIVED',
        payload: { patientId: patient.id, flowId: config.flowId },
      });
    });
  }

  private async flushEvents(runId: string, buffer: SimulationEventBuffer): Promise<void> {
    if (buffer.size === 0) return;
    const drained = buffer.drain();
    try {
      await this.simulationEventsRepository.createMany(runId, drained);
    } catch (err) {
      // SimulationEvent chỉ phục vụ xem lại/metrics — KHÔNG phải nguồn sự
      // thật cho routing/queue thật, nên chấp nhận mất 1 lô hơn là giữ
      // buffer phình to mãi nếu DB liên tục lỗi.
      this.logger.error(
        `Ghi SimulationEvent thất bại cho run #${runId} (mất ${drained.length} event): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async buildRuntimeState(
    runId: string,
    roomIds: number[],
  ): Promise<Pick<SimulationRunSnapshot, 'roomState' | 'patientLocations'>> {
    const [rooms, visits] = await Promise.all([
      this.roomsRepository.findAll({}),
      this.visitsRepository.findAllBySimulationRunWithGraph(runId),
    ]);
    const selectedRooms = rooms.filter((room) => roomIds.includes(room.id));
    const roomState = selectedRooms.map((room) => ({
      roomId: room.id,
      roomNumber: room.roomNumber,
      name: room.name,
      roomType: room.roomType.name,
      roomStatus: room.status,
      avgProcessTimeSeconds:
        room.avgProcessTime ?? room.roomType.avgProcessTime,
      examiningCount: 0,
      waitingCount: 0,
      estimatedWaitingSeconds: 0,
      currentPatient: null,
      queue: [],
    } as SimulationRoomState));
    const byRoom = new Map(roomState.map((room) => [room.roomId, room]));
    const patientLocations: SimulationPatientLocation[] = [];

    for (const visit of visits) {
      for (const step of visit.steps) {
        const assignment = step.assignments[0];
        const room = assignment ? byRoom.get(assignment.roomId) : undefined;
        const currentRoom = assignment?.room?.roomNumber ?? null;
        patientLocations.push({
          patientId: visit.patient.id,
          patientName: visit.patient.fullName,
          visitId: visit.id,
          visitStepId: step.id,
          stepDisplayOrder: step.displayOrder,
          currentStep: step.roomType.name,
          currentRoom,
          status: assignment?.status ?? step.status,
        });
        if (!room || !assignment) continue;

        const patient = {
          patientId: visit.patient.id,
          patientName: visit.patient.fullName,
          visitId: visit.id,
          visitStepId: step.id,
          currentStep: step.roomType.name,
          status: assignment.status,
        };
        if (assignment.status === 'IN_PROGRESS' || assignment.roomRuntime) {
          room.examiningCount += 1;
          room.currentPatient = patient;
        } else if (['WAITING', 'CHECKED_IN'].includes(assignment.status)) {
          room.waitingCount += 1;
          if (assignment.queueEntry) {
            room.queue.push({
              position: assignment.queueEntry.position,
              ...patient,
            });
          }
        }
      }
    }

    for (const room of roomState) {
      room.queue.sort((a, b) => a.position - b.position);
      room.estimatedWaitingSeconds =
        (room.examiningCount + room.waitingCount) * room.avgProcessTimeSeconds;
    }
    return { roomState, patientLocations };
  }

  private mapStopReasonToRunStatus(
    reason: SimulationEngineStopReason | 'FAILED_TO_RUN',
  ): SimulationRunStatus {
    switch (reason) {
      case 'COMPLETED':
        return SimulationRunStatus.COMPLETED;
      case 'STOPPED':
        return SimulationRunStatus.STOPPED;
      case 'MAX_EVENTS_EXCEEDED':
      case 'FAILED_TO_RUN':
      default:
        return SimulationRunStatus.FAILED;
    }
  }

  private mapEngineStatusToRunStatus(
    status: RunEngine['status'],
  ): SimulationRunStatus {
    switch (status) {
      case 'PENDING':
        return SimulationRunStatus.PENDING;
      case 'RUNNING':
        return SimulationRunStatus.RUNNING;
      case 'PAUSED':
        return SimulationRunStatus.PAUSED;
      case 'STOPPED':
        return SimulationRunStatus.STOPPED;
      case 'COMPLETED':
        return SimulationRunStatus.COMPLETED;
      case 'FAILED':
      default:
        return SimulationRunStatus.FAILED;
    }
  }
}
