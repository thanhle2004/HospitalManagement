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
    const tx = { transaction: 'test' };
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
});
