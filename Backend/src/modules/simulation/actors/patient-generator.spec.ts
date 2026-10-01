import { PatientGenerator } from './patient-generator';

function detail(
  status: 'WAITING' | 'COMPLETED' | 'CANCELLED',
  steps: Array<{ id: number; status: string; assignment: object | null }>,
) {
  return { id: 'visit-1', status, steps };
}

describe('PatientGenerator routing barrier', () => {
  it('keeps WALK_COMPLETED as a pipeline event but schedules it at the same simTime', async () => {
    const schedule = jest.fn();
    const actor = new PatientGenerator(
      {
        findDetailById: jest.fn().mockResolvedValue(
          detail('WAITING', [
            {
              id: 1,
              status: 'ASSIGNED',
              assignment: {
                room: { id: 4 },
                qrToken: 'qr-1',
              },
            },
          ]),
        ),
      } as never,
      {} as never,
      new Map([[4, 'device-4']]),
      {},
    );

    await (actor as any).progressVisit({ now: 77, schedule }, 'visit-1');

    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'WALK_COMPLETED',
        simTimeMs: 77,
        visitId: 'visit-1',
        visitStepId: 1,
      }),
    );
  });

  it('settles as soon as one assignment is active even while READY siblings remain', async () => {
    const visits = {
      findDetailById: jest.fn().mockResolvedValue(
        detail('WAITING', [
          { id: 1, status: 'ASSIGNED', assignment: { room: { id: 4 } } },
          { id: 2, status: 'READY', assignment: null },
        ]),
      ),
    };
    const sleep = jest.fn().mockResolvedValue(undefined);
    const actor = new PatientGenerator(
      visits as never,
      {} as never,
      new Map(),
      {},
      sleep,
      { findAllByVisitStepIds: jest.fn() } as never,
    );

    const result = await (actor as any).awaitRoutingSettled('visit-1');

    expect(result.detail.steps[0].status).toBe('ASSIGNED');
    expect(result.retryNeeded).toBe(false);
    expect(visits.findDetailById).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('settles when every READY routing entry is terminally failed', async () => {
    const visits = {
      findDetailById: jest.fn().mockResolvedValue(
        detail('WAITING', [{ id: 2, status: 'READY', assignment: null }]),
      ),
    };
    const routingQueue = {
      findAllByVisitStepIds: jest.fn().mockResolvedValue([
        { visitStepId: 2, status: 'FAILED', retryCount: 5 },
      ]),
    };
    const sleep = jest.fn().mockResolvedValue(undefined);
    const actor = new PatientGenerator(
      visits as never,
      {} as never,
      new Map(),
      { routingMaxRetryAttempts: 5 },
      sleep,
      routingQueue as never,
    );

    await (actor as any).awaitRoutingSettled('visit-1');

    expect(routingQueue.findAllByVisitStepIds).toHaveBeenCalledWith([2]);
    expect(visits.findDetailById).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries when a READY routing entry is temporarily missing during assignment commit', async () => {
    const ready = detail('WAITING', [
      { id: 2, status: 'READY', assignment: null },
    ]);
    const visits = {
      findDetailById: jest.fn().mockResolvedValue(ready),
    };
    const schedule = jest.fn();
    const actor = new PatientGenerator(
      visits as never,
      {} as never,
      new Map(),
      { routingPollMaxAttempts: 1, routingRetryDelaySimMs: 1_000 },
      jest.fn().mockResolvedValue(undefined),
      { findAllByVisitStepIds: jest.fn().mockResolvedValue([]) } as never,
    );

    await (actor as any).progressVisit({ now: 5_000, schedule }, 'visit-1');

    expect(schedule).toHaveBeenCalledWith({
      simTimeMs: 6_000,
      type: 'CONTINUE_VISIT',
      visitId: 'visit-1',
    });
  });

  it('schedules a simulation-time retry when routing finishes after the polling window', async () => {
    const ready = detail('WAITING', [
      { id: 2, status: 'READY', assignment: null },
    ]);
    const assigned = detail('WAITING', [
      {
        id: 2,
        status: 'ASSIGNED',
        assignment: { room: { id: 4 }, qrToken: 'late-qr' },
      },
    ]);
    const visits = {
      findDetailById: jest
        .fn()
        .mockResolvedValueOnce(ready)
        .mockResolvedValueOnce(ready)
        .mockResolvedValueOnce(assigned),
    };
    const schedule = jest.fn();
    const actor = new PatientGenerator(
      visits as never,
      {} as never,
      new Map([[4, 'device-4']]),
      { routingPollMaxAttempts: 1, routingRetryDelaySimMs: 1_000 },
      jest.fn().mockResolvedValue(undefined),
      {
        findAllByVisitStepIds: jest
          .fn()
          .mockResolvedValue([{ visitStepId: 2, status: 'PENDING', retryCount: 0 }]),
      } as never,
    );

    await (actor as any).progressVisit({ now: 5_000, schedule }, 'visit-1');
    expect(schedule).toHaveBeenCalledWith({
      simTimeMs: 6_000,
      type: 'CONTINUE_VISIT',
      visitId: 'visit-1',
    });

    await (actor as any).handleContinueVisit(
      { visitId: 'visit-1' },
      { now: 6_000, schedule },
    );
    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        simTimeMs: 6_000,
        type: 'WALK_COMPLETED',
        visitStepId: 2,
      }),
    );
  });
});
