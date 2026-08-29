import { ConflictException } from '@nestjs/common';
import { RoomStatus, UserRole } from '@prisma/client';
import { DoctorAssignmentsService } from './doctor-assignments.service';
import { DoctorAssignmentsRepository } from './repositories/doctor-assignments.repository';
import { UsersRepository } from '../users/users.repository';
import { RoomsRepository } from '../rooms/rooms.repository';

describe('DoctorAssignmentsService', () => {
  it('rejects a shift when the room already has a doctor in that time range', async () => {
    const repository = {
      findOverlapping: jest.fn().mockResolvedValue([]),
      findRoomOverlapping: jest.fn().mockResolvedValue([{ id: 2 }]),
      create: jest.fn(),
    };
    const usersRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'doctor-1',
        role: UserRole.DOCTOR,
      }),
    };
    const roomsRepository = {
      findById: jest.fn().mockResolvedValue({ id: 4, status: RoomStatus.ACTIVE }),
    };
    const service = new DoctorAssignmentsService(
      repository as unknown as DoctorAssignmentsRepository,
      usersRepository as unknown as UsersRepository,
      roomsRepository as unknown as RoomsRepository,
    );

    await expect(
      service.create({
        doctorId: 'doctor-1',
        roomId: 4,
        startTime: new Date('2026-08-29T01:00:00.000Z'),
        endTime: new Date('2026-08-29T09:00:00.000Z'),
      }),
    ).rejects.toThrow(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
