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
  it('records confirmation only for the doctor active on that duty assignment', async () => {
    const confirmedAt = new Date('2026-08-29T03:00:00.000Z');
    const baseAssignment = {
      id: 5,
      doctorId: 'doctor-1',
      startTime: new Date('2020-01-01T00:00:00.000Z'),
      endTime: null,
      roomConfirmedAt: null,
      doctor: {
        id: 'doctor-1',
        email: 'doctor@hospital.test',
        profile: { fullName: 'Bác sĩ An' },
      },
      room: { id: 4, roomNumber: 'P.204', name: 'Nội tổng quát' },
    };
    const doctorAssignmentsRepository = {
      findById: jest
        .fn()
        .mockResolvedValueOnce(baseAssignment)
        .mockResolvedValueOnce({
          ...baseAssignment,
          roomConfirmedAt: confirmedAt,
        }),
      confirmRoom: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DoctorService(
      doctorAssignmentsRepository as unknown as DoctorAssignmentsRepository,
      {} as VisitAssignmentsRepository,
      {} as RoomQueueEntriesRepository,
      {} as RoomRuntimeRepository,
      {} as VisitStepsRepository,
      {} as VisitsService,
      {} as PrismaService,
      {} as EventEmitter2,
    );

    const result = await service.confirmDutyRoom('doctor-1', 5);

    expect(doctorAssignmentsRepository.confirmRoom).toHaveBeenCalledWith(
      5,
      expect.any(Date),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 5,
        roomConfirmedAt: confirmedAt,
        room: expect.objectContaining({ roomNumber: 'P.204' }),
      }),
    );
  });

  it('keeps the queue locked until the doctor confirms the assigned room', async () => {
    const doctorAssignmentsRepository = {
      findActiveRoomIdsForDoctor: jest.fn().mockResolvedValue([]),
    };
    const visitAssignmentsRepository = {
      findByIdWithStep: jest.fn().mockResolvedValue({
        id: 9,
        roomId: 4,
        status: AssignmentStatus.CHECKED_IN,
        visitStep: { id: 12, visitId: 'visit-1' },
      }),
    };
    const roomRuntimeRepository = {
      ensureExists: jest.fn(),
    };
    const service = new DoctorService(
      doctorAssignmentsRepository as unknown as DoctorAssignmentsRepository,
      visitAssignmentsRepository as unknown as VisitAssignmentsRepository,
      {} as RoomQueueEntriesRepository,
      roomRuntimeRepository as unknown as RoomRuntimeRepository,
      {} as VisitStepsRepository,
      {} as VisitsService,
      {} as PrismaService,
      {} as EventEmitter2,
    );

    await expect(service.startExam('doctor-1', 9)).rejects.toThrow(
      'Bạn chưa xác nhận có mặt tại phòng trực được phân công',
    );
    expect(roomRuntimeRepository.ensureExists).not.toHaveBeenCalled();
  });

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
