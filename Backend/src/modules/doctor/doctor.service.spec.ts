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

  // [Phase 3] completeExam() không có test nào từ trước — 2 test dưới đây
  // vừa khoá lại hành vi bình thường, vừa là test hồi quy trực tiếp cho lỗi
  // đã sửa ở §2.3/§5.1 (CAS release RoomRuntime bị bỏ qua giá trị trả về).
  function buildCompleteExamService(overrides: {
    trySetCurrentAssignmentResults?: boolean[];
  }) {
    const tx = { transaction: 'test' };
    const doctorAssignmentsRepository = {
      findActiveRoomIdsForDoctor: jest.fn().mockResolvedValue([4]),
    };
    const visitAssignmentsRepository = {
      findByIdWithStep: jest.fn().mockResolvedValue({
        id: 9,
        roomId: 4,
        status: AssignmentStatus.IN_PROGRESS,
        visitStep: { id: 12, visitId: 'visit-1' },
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const results = overrides.trySetCurrentAssignmentResults ?? [true];
    let call = 0;
    const roomRuntimeRepository = {
      findByRoomId: jest.fn().mockResolvedValue({
        roomId: 4,
        currentVisitAssignmentId: 9,
        version: 3,
      }),
      trySetCurrentAssignment: jest.fn().mockImplementation(async () => {
        const result = results[Math.min(call, results.length - 1)];
        call += 1;
        return result;
      }),
    };
    const visitStepsRepository = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const roomQueueEntriesRepository = {
      deleteByVisitAssignment: jest.fn().mockResolvedValue(undefined),
    };
    const visitsService = {
      resolveDependenciesAndCheckCompletion: jest.fn().mockResolvedValue([34, 35]),
    };
    const prisma = {
      transaction: jest.fn(async (work: (transaction: unknown) => unknown) => work(tx)),
    };
    const eventEmitter = { emit: jest.fn() };
    const service = new DoctorService(
      doctorAssignmentsRepository as unknown as DoctorAssignmentsRepository,
      visitAssignmentsRepository as unknown as VisitAssignmentsRepository,
      roomQueueEntriesRepository as unknown as RoomQueueEntriesRepository,
      roomRuntimeRepository as unknown as RoomRuntimeRepository,
      visitStepsRepository as unknown as VisitStepsRepository,
      visitsService as unknown as VisitsService,
      prisma as unknown as PrismaService,
      eventEmitter as unknown as EventEmitter2,
    );
    return {
      service,
      tx,
      prisma,
      roomRuntimeRepository,
      visitAssignmentsRepository,
      visitStepsRepository,
      roomQueueEntriesRepository,
      visitsService,
      eventEmitter,
    };
  }

  it('completes the exam, releases the room, and emits VISIT_STEP_READY for every newly-unlocked step', async () => {
    const { service, tx, roomRuntimeRepository, roomQueueEntriesRepository, eventEmitter } =
      buildCompleteExamService({});

    const result = await service.completeExam('doctor-1', 9);

    expect(result).toEqual({ visitAssignmentId: 9, status: AssignmentStatus.COMPLETED });
    expect(roomRuntimeRepository.trySetCurrentAssignment).toHaveBeenCalledWith(4, null, 3, tx);
    expect(roomQueueEntriesRepository.deleteByVisitAssignment).toHaveBeenCalledWith(9, tx);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'visit-step.ready',
      expect.objectContaining({ visitStepId: 34 }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'visit-step.ready',
      expect.objectContaining({ visitStepId: 35 }),
    );
  });

  it('[regression for §2.3] retries the whole transaction when the RoomRuntime release CAS is lost, instead of silently leaving the room stuck occupied', async () => {
    const { service, prisma, roomRuntimeRepository } = buildCompleteExamService({
      trySetCurrentAssignmentResults: [false, true], // thua CAS lần 1 (bị 1 tiến trình khác chạm vào), thắng lần 2
    });

    const result = await service.completeExam('doctor-1', 9);

    expect(result).toEqual({ visitAssignmentId: 9, status: AssignmentStatus.COMPLETED });
    expect(roomRuntimeRepository.trySetCurrentAssignment).toHaveBeenCalledTimes(2);
    expect(prisma.transaction).toHaveBeenCalledTimes(2); // toàn bộ transaction chạy lại, không chỉ riêng bước release
  });

  it('gives up after MAX_LOCK_RETRY_ATTEMPTS instead of retrying forever', async () => {
    const { service, roomRuntimeRepository } = buildCompleteExamService({
      trySetCurrentAssignmentResults: [false, false, false], // luôn thua CAS
    });

    await expect(service.completeExam('doctor-1', 9)).rejects.toThrow(
      'Không thể hoàn thành khám do xung đột đồng thời',
    );
    expect(roomRuntimeRepository.trySetCurrentAssignment).toHaveBeenCalledTimes(3);
  });
});