import { SimulationAssertionsRunner } from './simulation-assertions.runner';

describe('SimulationAssertionsRunner isolation', () => {
  it('uses only the current run graph for historical routing data while checking shared-room state', async () => {
    const visitsRepository = {
      findAllBySimulationRunWithGraph: jest.fn().mockResolvedValue([
        {
          id: 'visit-b',
          status: 'COMPLETED',
          steps: [
            {
              id: 101,
              status: 'COMPLETED',
              updatedAt: new Date(0),
              dependencies: [],
              assignments: [{ id: 201, roomId: 4, status: 'COMPLETED' }],
            },
          ],
        },
      ]),
    };
    const roomRuntimeRepository = {
      findAllByRoomIds: jest.fn().mockResolvedValue([
        { roomId: 4, currentVisitAssignmentId: null },
      ]),
    };
    const roomQueueEntriesRepository = {
      findAllByRoomsWithDetails: jest.fn().mockResolvedValue([]),
    };
    const routingQueueRepository = {
      findAllByVisitStepIds: jest.fn().mockResolvedValue([]),
    };
    const routingDecisionsRepository = {
      findAllByVisitStepIds: jest.fn().mockResolvedValue([
        { visitStepId: 101, selectedRoomId: 4, candidates: [{ roomId: 4 }] },
      ]),
    };
    const simulationViolationsRepository = { createMany: jest.fn() };
    const runner = new SimulationAssertionsRunner(
      visitsRepository as never,
      roomRuntimeRepository as never,
      roomQueueEntriesRepository as never,
      routingQueueRepository as never,
      routingDecisionsRepository as never,
      simulationViolationsRepository as never,
    );

    const violations = await runner.sweep('run-b', [4], 0);

    expect(violations).toEqual([]);
    expect(routingQueueRepository.findAllByVisitStepIds).toHaveBeenCalledWith([101]);
    expect(routingDecisionsRepository.findAllByVisitStepIds).toHaveBeenCalledWith([101]);
    expect(roomRuntimeRepository.findAllByRoomIds).toHaveBeenCalledWith([4]);
    expect(roomQueueEntriesRepository.findAllByRoomsWithDetails).toHaveBeenCalledWith([4]);
    expect(simulationViolationsRepository.createMany).not.toHaveBeenCalled();
  });

  it('measures A11/A12 age in zero-based simulation time, never epoch wall-clock', async () => {
    const visitsRepository = {
      findAllBySimulationRunWithGraph: jest.fn().mockResolvedValue([
        {
          id: 'visit-1',
          status: 'WAITING',
          steps: [
            {
              id: 101,
              status: 'CHECKED_IN',
              updatedAt: new Date('2099-01-01T00:00:00.000Z'),
              dependencies: [],
              assignments: [{ id: 201, roomId: 4, status: 'CHECKED_IN' }],
            },
          ],
        },
        {
          id: 'visit-2',
          status: 'WAITING',
          steps: [
            {
              id: 102,
              status: 'READY',
              updatedAt: new Date('2099-01-01T00:00:00.000Z'),
              dependencies: [],
              assignments: [],
            },
          ],
        },
      ]),
    };
    const routingQueueRepository = {
      findAllByVisitStepIds: jest.fn().mockResolvedValue([
        {
          visitStepId: 101,
          status: 'PENDING',
          retryCount: 0,
          enqueueAt: new Date('1999-01-01T00:00:00.000Z'),
        },
        {
          visitStepId: 102,
          status: 'PENDING',
          retryCount: 0,
          enqueueAt: new Date('1999-01-01T00:00:00.000Z'),
        },
      ]),
    };
    const violationsRepository = { createMany: jest.fn().mockResolvedValue(undefined) };
    const runner = new SimulationAssertionsRunner(
      visitsRepository as never,
      { findAllByRoomIds: jest.fn().mockResolvedValue([]) } as never,
      { findAllByRoomsWithDetails: jest.fn().mockResolvedValue([]) } as never,
      routingQueueRepository as never,
      { findAllByVisitStepIds: jest.fn().mockResolvedValue([]) } as never,
      violationsRepository as never,
    );

    await expect(
      runner.sweep('run-1', [4], 0, {
        stuckThresholdMs: 60_000,
        routingMaxPendingMs: 60_000,
      }),
    ).resolves.toEqual([]);
    const violations = await runner.sweep('run-1', [4], 60_001, {
      stuckThresholdMs: 60_000,
      routingMaxPendingMs: 60_000,
    });

    expect(violations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining([
        'A11_PATIENT_STUCK',
        'A12_ORPHANED_ROUTING_ENTRY',
      ]),
    );

    await runner.sweep('run-1', [4], 65_001, {
      stuckThresholdMs: 60_000,
      routingMaxPendingMs: 60_000,
    });
    expect(violationsRepository.createMany).toHaveBeenCalledTimes(1);
  });
});
