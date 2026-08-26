import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssignmentStatus, VisitStepStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomQueueEntriesRepository } from '../check-in/repositories/room-queue-entries.repository';
import { DoctorAssignmentsRepository } from '../doctor-assignments/repositories/doctor-assignments.repository';
import { RoomRuntimeRepository } from '../rooms/room-runtime.repository';
import { VisitAssignmentsRepository } from '../routing/repositories/visit-assignments.repository';
import { VisitStepsRepository } from '../visits/repositories/visit-steps.repository';
import { VisitsService } from '../visits/visits.service';
import { DoctorService } from './doctor.service';

describe('DoctorService characterization', () => {
  it('claims an idle assigned room and starts the exam atomically', async () => {
    const tx = { transaction: 'test' };
    const doctorAssignmentsRepository = {
      findActiveRoomIdsForDoctor: jest.fn().mockResolvedValue([4]),
    };
    const visitAssignmentsRepository = {
      findByIdWithStep: jest.fn().mockResolvedValue({
        id: 9,
        roomId: 4,
        status: AssignmentStatus.CHECKED_IN,
        visitStep: { id: 12, visitId: 'visit-1' },
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const roomRuntimeRepository = {
      ensureExists: jest.fn().mockResolvedValue(undefined),
      findByRoomId: jest.fn().mockResolvedValue({
        roomId: 4,
        currentVisitAssignmentId: null,
        version: 3,
      }),
      trySetCurrentAssignment: jest.fn().mockResolvedValue(true),
    };
    const visitStepsRepository = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      transaction: jest.fn(async (work: (transaction: unknown) => unknown) =>
        work(tx),
      ),
    };
    const eventEmitter = { emit: jest.fn() };
    const service = new DoctorService(
      doctorAssignmentsRepository as unknown as DoctorAssignmentsRepository,
      visitAssignmentsRepository as unknown as VisitAssignmentsRepository,
      {} as RoomQueueEntriesRepository,
      roomRuntimeRepository as unknown as RoomRuntimeRepository,
      visitStepsRepository as unknown as VisitStepsRepository,
      {} as VisitsService,
      prisma as unknown as PrismaService,
      eventEmitter as unknown as EventEmitter2,
    );

    const result = await service.startExam('doctor-1', 9);

    expect(result).toEqual({
      visitAssignmentId: 9,
      status: AssignmentStatus.IN_PROGRESS,
    });
    expect(roomRuntimeRepository.trySetCurrentAssignment).toHaveBeenCalledWith(
      4,
      9,
      3,
      tx,
    );
    expect(visitAssignmentsRepository.updateStatus).toHaveBeenCalledWith(
      9,
      AssignmentStatus.IN_PROGRESS,
      expect.objectContaining({
        startedAt: expect.any(Date),
        doctorId: 'doctor-1',
      }),
      tx,
    );
    expect(visitStepsRepository.updateStatus).toHaveBeenCalledWith(
      12,
      VisitStepStatus.IN_PROGRESS,
      {},
      tx,
    );
  });
});
