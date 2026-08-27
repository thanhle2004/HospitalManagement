import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssignmentStatus } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { RoomQueueEntriesRepository } from '../check-in/repositories/room-queue-entries.repository';
import { AdminQueueService } from './admin-queue.service';

describe('AdminQueueService reorder safeguards', () => {
  it('does not reorder a patient whose exam is already in progress', async () => {
    const queueRepository = {
      findByIdWithAssignment: jest.fn().mockResolvedValue({
        id: 4,
        roomId: 1,
        position: 1,
        visitAssignment: { status: AssignmentStatus.IN_PROGRESS },
      }),
      getMinPosition: jest.fn(),
      updatePosition: jest.fn(),
    };
    const service = new AdminQueueService(
      queueRepository as unknown as RoomQueueEntriesRepository,
      { log: jest.fn() } as unknown as ActivityLogService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

    await expect(service.moveToFront('admin-1', 4)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(queueRepository.updatePosition).not.toHaveBeenCalled();
  });

  it('moves a waiting patient and records the intervention', async () => {
    const queueRepository = {
      findByIdWithAssignment: jest.fn().mockResolvedValue({
        id: 4,
        roomId: 1,
        position: 3,
        visitAssignment: { status: AssignmentStatus.CHECKED_IN },
      }),
      getMinPosition: jest.fn().mockResolvedValue(1),
      updatePosition: jest.fn().mockResolvedValue(undefined),
    };
    const activityLogService = { log: jest.fn().mockResolvedValue(undefined) };
    const eventEmitter = { emit: jest.fn() };
    const service = new AdminQueueService(
      queueRepository as unknown as RoomQueueEntriesRepository,
      activityLogService as unknown as ActivityLogService,
      eventEmitter as unknown as EventEmitter2,
    );

    await service.moveToFront('admin-1', 4);

    expect(queueRepository.updatePosition).toHaveBeenCalledWith(4, 0);
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'ROOM_QUEUE_MOVE_TO_FRONT',
        entityId: '4',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalled();
  });
});
