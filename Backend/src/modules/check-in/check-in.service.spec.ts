import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssignmentStatus, VisitStepStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DevicesRepository } from '../devices/devices.repository';
import { VisitAssignmentsRepository } from '../routing/repositories/visit-assignments.repository';
import { VisitTokensRepository } from '../routing/repositories/visit-tokens.repository';
import { VisitStepsRepository } from '../visits/repositories/visit-steps.repository';
import { CheckInService } from './check-in.service';
import { CheckInLogsRepository } from './repositories/check-in-logs.repository';
import { RoomQueueEntriesRepository } from './repositories/room-queue-entries.repository';

describe('CheckInService characterization', () => {
  it('consumes a valid room QR and enqueues the patient in one transaction', async () => {
    const tx = {
      transaction: 'test',
      $queryRaw: jest.fn().mockResolvedValue([{ id: 4 }]),
    };
    const devicesRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'device-1', roomId: 4 }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const tokenRepository = {
      findByToken: jest.fn().mockResolvedValue({
        id: 'token-1',
        visitAssignmentId: 9,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
      markUsed: jest.fn().mockResolvedValue(undefined),
    };
    const assignmentsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 9,
        roomId: 4,
        visitStepId: 12,
        status: AssignmentStatus.WAITING,
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const stepsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 12,
        visitId: 'visit-1',
        status: VisitStepStatus.ASSIGNED,
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const queueRepository = {
      getNextPosition: jest.fn().mockResolvedValue(2),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const logsRepository = { create: jest.fn().mockResolvedValue(undefined) };
    const prisma = {
      transaction: jest.fn(async (work: (transaction: unknown) => unknown) =>
        work(tx),
      ),
    };
    const eventEmitter = { emit: jest.fn() };
    const service = new CheckInService(
      devicesRepository as unknown as DevicesRepository,
      tokenRepository as unknown as VisitTokensRepository,
      assignmentsRepository as unknown as VisitAssignmentsRepository,
      stepsRepository as unknown as VisitStepsRepository,
      queueRepository as unknown as RoomQueueEntriesRepository,
      logsRepository as unknown as CheckInLogsRepository,
      prisma as unknown as PrismaService,
      eventEmitter as unknown as EventEmitter2,
    );

    const result = await service.checkIn('device-1', { token: 'qr-value' });

    expect(result).toEqual({
      visitStepId: 12,
      status: VisitStepStatus.CHECKED_IN,
      roomId: 4,
      queuePosition: 2,
    });
    expect(tokenRepository.markUsed).toHaveBeenCalledWith('token-1', tx);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(assignmentsRepository.updateStatus).toHaveBeenCalledWith(
      9,
      AssignmentStatus.CHECKED_IN,
      expect.objectContaining({ checkedInAt: expect.any(Date) }),
      tx,
    );
    expect(stepsRepository.updateStatus).toHaveBeenCalledWith(
      12,
      VisitStepStatus.CHECKED_IN,
      {},
      tx,
    );
    expect(queueRepository.create).toHaveBeenCalled();
    expect(logsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
      tx,
    );
  });

  it('serializes concurrent check-ins in one room so queue positions stay unique and no patient is lost', async () => {
    const devicesRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'device-1', roomId: 4 }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const tokenRepository = {
      findByToken: jest.fn(async (token: string) => ({
        id: `token-${token.slice(-1)}`,
        visitAssignmentId: Number(token.slice(-1)),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      })),
      markUsed: jest.fn().mockResolvedValue(undefined),
    };
    const assignmentsRepository = {
      findById: jest.fn(async (id: number) => ({
        id,
        roomId: 4,
        visitStepId: 10 + id,
        status: AssignmentStatus.WAITING,
      })),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const stepsRepository = {
      findById: jest.fn(async (id: number) => ({
        id,
        visitId: `visit-${id}`,
        status: VisitStepStatus.ASSIGNED,
      })),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };

    const positions: number[] = [];
    const queueRepository = {
      getNextPosition: jest.fn(async () => (positions.length === 0 ? 1 : Math.max(...positions) + 1)),
      create: jest.fn(async (data: { position: number }) => {
        // Yield once to make the original unlocked max+1 race deterministic.
        await Promise.resolve();
        positions.push(data.position);
      }),
    };
    const logsRepository = { create: jest.fn().mockResolvedValue(undefined) };

    // A tiny transaction/row-lock harness: every transaction starts, but its
    // SELECT ... FOR UPDATE waits for the prior holder of room #4 to commit.
    let roomLockTail = Promise.resolve();
    const prisma = {
      transaction: jest.fn(async (work: (tx: { $queryRaw: jest.Mock }) => Promise<unknown>) => {
        const previousHolder = roomLockTail;
        let releaseRoomLock!: () => void;
        roomLockTail = new Promise<void>((resolve) => {
          releaseRoomLock = resolve;
        });
        const tx = { $queryRaw: jest.fn(async () => previousHolder) };
        try {
          return await work(tx);
        } finally {
          releaseRoomLock();
        }
      }),
    };
    const service = new CheckInService(
      devicesRepository as unknown as DevicesRepository,
      tokenRepository as unknown as VisitTokensRepository,
      assignmentsRepository as unknown as VisitAssignmentsRepository,
      stepsRepository as unknown as VisitStepsRepository,
      queueRepository as unknown as RoomQueueEntriesRepository,
      logsRepository as unknown as CheckInLogsRepository,
      prisma as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

    const results = await Promise.all([
      service.checkIn('device-1', { token: 'qr-1' }),
      service.checkIn('device-1', { token: 'qr-2' }),
    ]);

    expect(results.map((result) => result.queuePosition).sort()).toEqual([1, 2]);
    expect(positions.sort()).toEqual([1, 2]);
    expect(queueRepository.create).toHaveBeenCalledTimes(2);
  });

  it('cancels a no-show and atomically removes every source of phantom room load', async () => {
    const tx = {
      visitStep: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 12,
            status: VisitStepStatus.ASSIGNED,
            assignments: [
              { id: 9, roomId: 4, status: AssignmentStatus.WAITING },
            ],
          },
          { id: 13, status: VisitStepStatus.READY, assignments: [] },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      roomQueueEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      visitToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      roomRuntime: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      visitAssignment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      routingQueue: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      visit: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      transaction: jest.fn(async (work: (transaction: typeof tx) => unknown) =>
        work(tx),
      ),
    };
    const eventEmitter = { emit: jest.fn() };
    const service = new CheckInService(
      {} as DevicesRepository,
      {} as VisitTokensRepository,
      {} as VisitAssignmentsRepository,
      {} as VisitStepsRepository,
      {} as RoomQueueEntriesRepository,
      {} as CheckInLogsRepository,
      prisma as unknown as PrismaService,
      eventEmitter as unknown as EventEmitter2,
    );

    await expect(service.cancelNoShow('visit-1', 12)).resolves.toBe(true);

    expect(tx.roomQueueEntry.deleteMany).toHaveBeenCalledWith({
      where: { visitAssignmentId: { in: [9] } },
    });
    expect(tx.visitToken.deleteMany).toHaveBeenCalledWith({
      where: { visitAssignmentId: { in: [9] } },
    });
    expect(tx.visitAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [9] } },
        data: expect.objectContaining({
          status: AssignmentStatus.CANCELLED,
          cancelReason: 'NO_SHOW_TIMEOUT',
        }),
      }),
    );
    expect(tx.routingQueue.deleteMany).toHaveBeenCalledWith({
      where: { visitStepId: { in: [12, 13] } },
    });
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'visit-1' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
  });
});
