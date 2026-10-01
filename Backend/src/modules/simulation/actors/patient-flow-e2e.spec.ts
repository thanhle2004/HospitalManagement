import { SimulationEngine } from '../engine/simulation-engine';
import { PatientGenerator } from './patient-generator';
import { DoctorSimulator } from './doctor-simulator';
import { PatientFlowEventType, PatientFlowPayload } from './patient-flow-events';

/**
 * "Bệnh viện giả" tối thiểu — mô hình hoá ĐÚNG state machine mà VisitsService
 * /CheckInService/DoctorService thật vận hành (VisitStep: LOCKED -> READY ->
 * ASSIGNED -> CHECKED_IN -> IN_PROGRESS -> COMPLETED, xem
 * docs/simulator-architecture.md §1.4), nhưng lưu toàn bộ trong bộ nhớ thay
 * vì MySQL thật.
 *
 * QUAN TRỌNG: đây KHÔNG phải mock kiểu "trả về giá trị cố định" — nó mô
 * phỏng đúng độ trễ bất đồng bộ có thật của routing engine (§2.1: routing
 * không xong ngay khi VisitsService.create() trả về) bằng `routingDelayTicks`
 * — 1 step chỉ thực sự chuyển READY -> ASSIGNED sau đúng N lần
 * findDetailById() được gọi. Nhờ vậy bài test này thực sự exercise vòng
 * bounded-poll của PatientGenerator.awaitRoutingSettled(), không chỉ giả
 * định routing xong ngay lập tức.
 */
type FakeStepStatus =
  | 'LOCKED'
  | 'READY'
  | 'ASSIGNED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

interface FlowStepDefinition {
  stepId: number;
  roomId: number;
  dependsOn: number[];
}

interface FakeStep {
  id: number;
  assignmentId: number;
  status: FakeStepStatus;
  roomId: number;
  dependsOn: number[];
  qrToken: string | null;
}

interface FakeVisit {
  id: string;
  status: 'WAITING' | 'COMPLETED' | 'CANCELLED';
  steps: FakeStep[];
}

function createFakeHospital(
  flowDefinition: FlowStepDefinition[],
  roomIdToDoctorId: ReadonlyMap<number, string>,
  options: { routingDelayTicks?: number } = {},
) {
  const routingDelayTicks = options.routingDelayTicks ?? 2;
  const visits = new Map<string, FakeVisit>();
  const routingInFlight: Array<{ visitId: string; stepId: number; ticksLeft: number }> = [];
  let nextVisitSeq = 1;
  let nextAssignmentSeq = 1;
  let nextTokenSeq = 1;

  function enqueueRouting(visitId: string, stepId: number) {
    routingInFlight.push({ visitId, stepId, ticksLeft: routingDelayTicks });
  }

  /** Gọi mỗi lần findDetailById() — mô phỏng "1 tick thời gian trôi qua chờ routing engine xử lý xong" */
  function tickRouting() {
    for (let i = routingInFlight.length - 1; i >= 0; i--) {
      const entry = routingInFlight[i];
      entry.ticksLeft -= 1;
      if (entry.ticksLeft <= 0) {
        const visit = visits.get(entry.visitId);
        const step = visit?.steps.find((s) => s.id === entry.stepId);
        if (step) {
          step.status = 'ASSIGNED';
          step.qrToken = `tok-${nextTokenSeq++}`;
        }
        routingInFlight.splice(i, 1);
      }
    }
  }

  function findByAssignmentId(assignmentId: number): { visit: FakeVisit; step: FakeStep } {
    for (const visit of visits.values()) {
      const step = visit.steps.find((s) => s.assignmentId === assignmentId);
      if (step) return { visit, step };
    }
    throw new Error(`fake hospital: assignment/step #${assignmentId} không tồn tại`);
  }

  const visitsService = {
    create: jest.fn(async (_patientId: string, _dto: { flowId: number }) => {
      const id = `visit-${nextVisitSeq++}`;
      const steps: FakeStep[] = flowDefinition.map((d) => ({
        id: d.stepId,
        assignmentId: nextAssignmentSeq++,
        status: d.dependsOn.length === 0 ? 'READY' : 'LOCKED',
        roomId: d.roomId,
        dependsOn: d.dependsOn,
        qrToken: null,
      }));
      visits.set(id, { id, status: 'WAITING', steps });
      for (const s of steps.filter((s) => s.status === 'READY')) {
        enqueueRouting(id, s.id);
      }
      return { id, status: 'WAITING' as const };
    }),

    findDetailById: jest.fn(async (visitId: string, _ownerPatientId: string | null) => {
      tickRouting();
      const visit = visits.get(visitId);
      if (!visit) throw new Error(`fake hospital: visit #${visitId} không tồn tại`);
      return {
        id: visit.id,
        status: visit.status,
        steps: visit.steps.map((s) => ({
          id: s.id,
          status: s.status,
          assignment:
            s.status === 'LOCKED' || s.status === 'READY'
              ? null
              : {
                  room: { id: s.roomId, roomNumber: `P${s.roomId}`, name: `Phòng ${s.roomId}` },
                  qrToken: s.status === 'ASSIGNED' ? s.qrToken : null,
                  qrExpiresAt: null,
                },
        })),
      };
    }),
  };

  const checkInService = {
    checkIn: jest.fn(async (_deviceId: string, dto: { token: string }) => {
      for (const visit of visits.values()) {
        const step = visit.steps.find((s) => s.qrToken === dto.token);
        if (step) {
          if (step.status !== 'ASSIGNED') {
            throw new Error(`fake hospital: step #${step.id} không ở trạng thái ASSIGNED`);
          }
          step.status = 'CHECKED_IN';
          return { visitStepId: step.id, status: 'CHECKED_IN' as const, roomId: step.roomId, queuePosition: 1 };
        }
      }
      throw new Error(`fake hospital: token không tồn tại: ${dto.token}`);
    }),
    cancelNoShow: jest.fn(async (visitId: string, visitStepId: number) => {
      const visit = visits.get(visitId);
      const step = visit?.steps.find((candidate) => candidate.id === visitStepId);
      if (!visit || !step || step.status !== 'ASSIGNED') return false;
      visit.status = 'CANCELLED';
      for (const candidate of visit.steps) {
        if (candidate.status !== 'COMPLETED') candidate.status = 'CANCELLED';
      }
      return true;
    }),
  };

  const doctorService = {
    getMyQueue: jest.fn(async (doctorId: string) => {
      const entries: Array<{
        queueEntryId: number;
        position: number;
        visitAssignmentId: number;
        visitStepId: number;
        status: 'CHECKED_IN' | 'IN_PROGRESS';
        room: { id: number; roomNumber: string; name: string };
        roomType: { id: number; name: string };
        patient: { id: string; fullName: string; phone: string };
        checkedInAt: null;
      }> = [];
      for (const visit of visits.values()) {
        for (const step of visit.steps) {
          if (
            (step.status === 'CHECKED_IN' || step.status === 'IN_PROGRESS') &&
            roomIdToDoctorId.get(step.roomId) === doctorId
          ) {
            entries.push({
              queueEntryId: step.assignmentId,
              position: step.assignmentId,
              visitAssignmentId: step.assignmentId,
              visitStepId: step.id,
              status: step.status,
              room: { id: step.roomId, roomNumber: `P${step.roomId}`, name: `Phòng ${step.roomId}` },
              roomType: { id: 1, name: 'Khám tổng quát' },
              patient: { id: 'p', fullName: 'Bệnh nhân mô phỏng', phone: 'SIM' },
              checkedInAt: null,
            });
          }
        }
      }
      return entries.sort((a, b) => a.position - b.position);
    }),

    startExam: jest.fn(async (_doctorId: string, visitAssignmentId: number) => {
      const { step } = findByAssignmentId(visitAssignmentId);
      if (step.status !== 'CHECKED_IN') {
        throw new Error(`fake hospital: step #${step.id} không ở trạng thái CHECKED_IN`);
      }
      step.status = 'IN_PROGRESS';
      return { visitAssignmentId, status: 'IN_PROGRESS' as const };
    }),

    completeExam: jest.fn(async (_doctorId: string, visitAssignmentId: number) => {
      const { visit, step } = findByAssignmentId(visitAssignmentId);
      if (step.status !== 'IN_PROGRESS') {
        throw new Error(`fake hospital: step #${step.id} không ở trạng thái IN_PROGRESS`);
      }
      step.status = 'COMPLETED';

      for (const s of visit.steps) {
        if (
          s.status === 'LOCKED' &&
          s.dependsOn.every((depId) => visit.steps.find((x) => x.id === depId)?.status === 'COMPLETED')
        ) {
          s.status = 'READY';
          enqueueRouting(visit.id, s.id);
        }
      }
      if (visit.steps.every((s) => s.status === 'COMPLETED')) {
        visit.status = 'COMPLETED';
      }

      return { visitAssignmentId, status: 'COMPLETED' as const };
    }),
  };

  const visitStepsRepository = {
    findById: jest.fn(async (id: number) => {
      for (const visit of visits.values()) {
        const step = visit.steps.find((s) => s.id === id);
        if (step) return { id: step.id, visitId: visit.id, status: step.status } as never;
      }
      return null;
    }),
  };

  return { visits, visitsService, checkInService, doctorService, visitStepsRepository };
}

const instantSleep = () => Promise.resolve();

describe('PatientGenerator + DoctorSimulator (Phase 2 end-to-end gate)', () => {
  it('drives one synthetic patient through a 2-step visit end-to-end, calling only the real production services, until the visit COMPLETES and the engine queue drains naturally', async () => {
    const roomIdToDoctorId = new Map([
      [10, 'doctor-A'],
      [20, 'doctor-B'],
    ]);
    const roomIdToDeviceId = new Map([
      [10, 'device-10'],
      [20, 'device-20'],
    ]);
    const flow: FlowStepDefinition[] = [
      { stepId: 1, roomId: 10, dependsOn: [] },
      { stepId: 2, roomId: 20, dependsOn: [1] }, // tuần tự — bước 2 chỉ sẵn sàng sau khi bước 1 COMPLETED
    ];
    const hospital = createFakeHospital(flow, roomIdToDoctorId);

    const patientGenerator = new PatientGenerator(
      hospital.visitsService as never,
      hospital.checkInService as never,
      roomIdToDeviceId,
      { routingPollIntervalMs: 1 },
      instantSleep,
    );
    const doctorSimulator = new DoctorSimulator(
      hospital.doctorService as never,
      hospital.visitStepsRepository as never,
      roomIdToDoctorId,
      new Map([
        [10, { meanSeconds: 0.5 }],
        [20, { meanSeconds: 0.5 }],
      ]),
    );

    const engine = new SimulationEngine<PatientFlowEventType, PatientFlowPayload>({
      seed: 12345,
      mode: 'LOCKSTEP',
      clock: { policy: 'ASAP' },
    });
    patientGenerator.register(engine);
    doctorSimulator.register(engine);

    engine.schedule({
      simTimeMs: 0,
      type: 'PATIENT_ARRIVED',
      payload: { patientId: 'patient-1', flowId: 7 },
    });

    const result = await engine.run();

    expect(result).toBe('COMPLETED'); // hàng đợi tự rỗng — không có gì tự lặp lại vô căn cứ
    expect(hospital.visits.get('visit-1')?.status).toBe('COMPLETED');
    expect(hospital.visits.get('visit-1')?.steps.map((s) => s.status)).toEqual([
      'COMPLETED',
      'COMPLETED',
    ]);

    // Đúng những service PRODUCTION thật được gọi — không có đường tắt nào khác
    expect(hospital.visitsService.create).toHaveBeenCalledWith('patient-1', { flowId: 7 });
    expect(hospital.checkInService.checkIn).toHaveBeenCalledWith('device-10', {
      token: expect.stringMatching(/^tok-/),
    });
    expect(hospital.checkInService.checkIn).toHaveBeenCalledWith('device-20', {
      token: expect.stringMatching(/^tok-/),
    });
    expect(hospital.doctorService.startExam).toHaveBeenCalledWith('doctor-A', 1);
    expect(hospital.doctorService.completeExam).toHaveBeenCalledWith('doctor-A', 1);
    expect(hospital.doctorService.startExam).toHaveBeenCalledWith('doctor-B', 2);
    expect(hospital.doctorService.completeExam).toHaveBeenCalledWith('doctor-B', 2);

    // Bước 2 KHÔNG được bắt đầu trước khi bước 1 hoàn tất (đúng thứ tự phụ thuộc)
    const startOrder = hospital.doctorService.startExam.mock.invocationCallOrder;
    const completeOrder = hospital.doctorService.completeExam.mock.invocationCallOrder;
    expect(completeOrder[0]).toBeLessThan(startOrder[1]);
  });

  it('a no-show patient never checks in, and the run still completes instead of hanging', async () => {
    const roomIdToDoctorId = new Map([[10, 'doctor-A']]);
    const roomIdToDeviceId = new Map([[10, 'device-10']]);
    const hospital = createFakeHospital([{ stepId: 1, roomId: 10, dependsOn: [] }], roomIdToDoctorId);

    const patientGenerator = new PatientGenerator(
      hospital.visitsService as never,
      hospital.checkInService as never,
      roomIdToDeviceId,
      { noShowProbability: 1, routingPollIntervalMs: 1 },
      instantSleep,
    );
    const doctorSimulator = new DoctorSimulator(
      hospital.doctorService as never,
      hospital.visitStepsRepository as never,
      roomIdToDoctorId,
    );

    const engine = new SimulationEngine<PatientFlowEventType, PatientFlowPayload>({
      seed: 1,
      mode: 'LOCKSTEP',
      clock: { policy: 'ASAP' },
    });
    patientGenerator.register(engine);
    doctorSimulator.register(engine);
    engine.schedule({ simTimeMs: 0, type: 'PATIENT_ARRIVED', payload: { patientId: 'p1', flowId: 1 } });

    const result = await engine.run();

    expect(result).toBe('COMPLETED');
    expect(hospital.checkInService.cancelNoShow).toHaveBeenCalledWith('visit-1', 1);
    expect(hospital.visits.get('visit-1')?.status).toBe('CANCELLED');
    expect(hospital.checkInService.checkIn).not.toHaveBeenCalled();
    expect(hospital.doctorService.startExam).not.toHaveBeenCalled();
  });

  it('does nothing and does not throw when a room has no device provisioned in this scenario', async () => {
    const roomIdToDoctorId = new Map([[10, 'doctor-A']]);
    const roomIdToDeviceId = new Map<number, string>(); // phòng 10 không có device
    const hospital = createFakeHospital([{ stepId: 1, roomId: 10, dependsOn: [] }], roomIdToDoctorId);

    const patientGenerator = new PatientGenerator(
      hospital.visitsService as never,
      hospital.checkInService as never,
      roomIdToDeviceId,
      { routingPollIntervalMs: 1 },
      instantSleep,
    );
    const doctorSimulator = new DoctorSimulator(
      hospital.doctorService as never,
      hospital.visitStepsRepository as never,
      roomIdToDoctorId,
    );

    const engine = new SimulationEngine<PatientFlowEventType, PatientFlowPayload>({
      seed: 1,
      mode: 'LOCKSTEP',
      clock: { policy: 'ASAP' },
    });
    patientGenerator.register(engine);
    doctorSimulator.register(engine);
    engine.schedule({ simTimeMs: 0, type: 'PATIENT_ARRIVED', payload: { patientId: 'p1', flowId: 1 } });

    await expect(engine.run()).resolves.toBe('COMPLETED');
    expect(hospital.checkInService.checkIn).not.toHaveBeenCalled();
  });

  it('does nothing and does not throw when a room has no doctor on duty in this scenario', async () => {
    const roomIdToDoctorId = new Map<number, string>(); // không có bác sĩ nào
    const roomIdToDeviceId = new Map([[10, 'device-10']]);
    const hospital = createFakeHospital([{ stepId: 1, roomId: 10, dependsOn: [] }], roomIdToDoctorId);

    const patientGenerator = new PatientGenerator(
      hospital.visitsService as never,
      hospital.checkInService as never,
      roomIdToDeviceId,
      { routingPollIntervalMs: 1 },
      instantSleep,
    );
    const doctorSimulator = new DoctorSimulator(
      hospital.doctorService as never,
      hospital.visitStepsRepository as never,
      roomIdToDoctorId,
    );

    const engine = new SimulationEngine<PatientFlowEventType, PatientFlowPayload>({
      seed: 1,
      mode: 'LOCKSTEP',
      clock: { policy: 'ASAP' },
    });
    patientGenerator.register(engine);
    doctorSimulator.register(engine);
    engine.schedule({ simTimeMs: 0, type: 'PATIENT_ARRIVED', payload: { patientId: 'p1', flowId: 1 } });

    await expect(engine.run()).resolves.toBe('COMPLETED');
    // Bệnh nhân ĐÃ check-in thành công (có device) — chỉ riêng bác sĩ là không có
    expect(hospital.checkInService.checkIn).toHaveBeenCalled();
    expect(hospital.doctorService.getMyQueue).not.toHaveBeenCalled();
  });

  it('serves 2 patients queued at the same single-doctor room strictly one at a time (FIFO), never both IN_PROGRESS at once', async () => {
    const roomIdToDoctorId = new Map([[10, 'doctor-A']]);
    const roomIdToDeviceId = new Map([[10, 'device-10']]);
    const hospital = createFakeHospital([{ stepId: 1, roomId: 10, dependsOn: [] }], roomIdToDoctorId, {
      routingDelayTicks: 1,
    });

    const patientGenerator = new PatientGenerator(
      hospital.visitsService as never,
      hospital.checkInService as never,
      roomIdToDeviceId,
      { routingPollIntervalMs: 1 },
      instantSleep,
    );
    const doctorSimulator = new DoctorSimulator(
      hospital.doctorService as never,
      hospital.visitStepsRepository as never,
      roomIdToDoctorId,
      new Map([[10, { meanSeconds: 1 }]]),
    );

    const engine = new SimulationEngine<PatientFlowEventType, PatientFlowPayload>({
      seed: 1,
      mode: 'LOCKSTEP',
      clock: { policy: 'ASAP' },
    });
    patientGenerator.register(engine);
    doctorSimulator.register(engine);
    engine.schedule({ simTimeMs: 0, type: 'PATIENT_ARRIVED', payload: { patientId: 'p1', flowId: 1 } });
    engine.schedule({ simTimeMs: 0, type: 'PATIENT_ARRIVED', payload: { patientId: 'p2', flowId: 1 } });

    await expect(engine.run()).resolves.toBe('COMPLETED');

    expect(hospital.visits.get('visit-1')?.steps[0].status).toBe('COMPLETED');
    expect(hospital.visits.get('visit-2')?.steps[0].status).toBe('COMPLETED');
    expect(hospital.doctorService.startExam).toHaveBeenCalledTimes(2);
    expect(hospital.doctorService.completeExam).toHaveBeenCalledTimes(2);

    // Bất biến A1 (§11): không bao giờ start bệnh nhân thứ 2 trước khi bệnh
    // nhân thứ 1 đã completeExam — kiểm bằng thứ tự lời gọi thực tế.
    const calls = [
      ...hospital.doctorService.startExam.mock.invocationCallOrder.map((order) => ({ order, kind: 'start' })),
      ...hospital.doctorService.completeExam.mock.invocationCallOrder.map((order) => ({ order, kind: 'complete' })),
    ].sort((a, b) => a.order - b.order);
    expect(calls.map((c) => c.kind)).toEqual(['start', 'complete', 'start', 'complete']);
  });
});
