import { SimulationOrchestratorService } from './simulation-orchestrator.service';

describe('SimulationOrchestratorService room state projection', () => {
  it('projects idle, active, queued, and completed patients from runtime data', async () => {
    const orchestrator = new SimulationOrchestratorService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        findAllBySimulationRunWithGraph: jest.fn().mockResolvedValue([
          {
            id: 'visit-1',
            patient: { id: 'P001' },
            steps: [{
              id: 11,
              status: 'IN_PROGRESS',
              roomType: { name: 'ECG' },
              assignments: [{
                roomId: 1,
                status: 'IN_PROGRESS',
                room: { roomNumber: 'ECG-02' },
                roomRuntime: { currentVisitAssignmentId: 101 },
                queueEntry: null,
              }],
            }],
          },
          {
            id: 'visit-2',
            patient: { id: 'P002' },
            steps: [{
              id: 12,
              status: 'ASSIGNED',
              roomType: { name: 'ECG' },
              assignments: [{
                roomId: 1,
                status: 'CHECKED_IN',
                room: { roomNumber: 'ECG-02' },
                roomRuntime: null,
                queueEntry: { position: 1 },
              }],
            }],
          },
          {
            id: 'visit-3',
            patient: { id: 'P003' },
            steps: [{
              id: 13,
              status: 'COMPLETED',
              roomType: { name: 'LAB' },
              assignments: [{
                roomId: 2,
                status: 'COMPLETED',
                room: { roomNumber: 'LAB-01' },
                roomRuntime: null,
                queueEntry: null,
              }],
            }],
          },
        ]),
      } as never,
      {
        findAll: jest.fn().mockResolvedValue([
          { id: 1, roomNumber: 'ECG-02', name: 'ECG', status: 'ACTIVE', avgProcessTime: 90, roomType: { name: 'ECG', avgProcessTime: 180 } },
          { id: 2, roomNumber: 'LAB-01', name: 'Lab', status: 'ACTIVE', avgProcessTime: null, roomType: { name: 'LAB', avgProcessTime: 480 } },
        ]),
      } as never,
      {} as never,
    );

    const state = await orchestrator.getRuntimeStateForRun('run-1', [1, 2]);
    const ecg = state.roomState.find((room) => room.roomId === 1)!;
    const lab = state.roomState.find((room) => room.roomId === 2)!;

    expect(ecg.examiningCount).toBe(1);
    expect(ecg.waitingCount).toBe(1);
    expect(ecg.currentPatient?.patientId).toBe('P001');
    expect(ecg.queue.map((patient) => patient.patientId)).toEqual(['P002']);
    expect(ecg.avgProcessTimeSeconds).toBe(90);
    expect(ecg.estimatedWaitingSeconds).toBe(180);
    expect(lab.examiningCount).toBe(0);
    expect(lab.waitingCount).toBe(0);
    expect(lab.avgProcessTimeSeconds).toBe(480);
    expect(lab.estimatedWaitingSeconds).toBe(0);
    expect(state.patientLocations.find((location) => location.patientId === 'P003')).toEqual(
      expect.objectContaining({ currentRoom: 'LAB-01', status: 'COMPLETED' }),
    );
  });
});
