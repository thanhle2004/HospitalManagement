import {
  DeviceStatus,
  DeviceType,
  RoomStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsRepository } from './rooms.repository';

describe('RoomsRepository routing eligibility', () => {
  it('requires an ACTIVE room, a confirmed on-duty doctor, and an ACTIVE QR scanner', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new RoomsRepository({ room: { findMany } } as unknown as PrismaService);
    const at = new Date('2026-09-29T08:00:00.000Z');

    await repository.findRoutingEligibleByRoomType(7, at);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        roomTypeId: 7,
        status: RoomStatus.ACTIVE,
        doctorAssignments: {
          some: {
            startTime: { lte: at },
            roomConfirmedAt: { not: null },
            OR: [{ endTime: null }, { endTime: { gt: at } }],
            doctor: { role: UserRole.DOCTOR, status: UserStatus.ACTIVE },
          },
        },
        devices: {
          some: { type: DeviceType.QR_SCANNER, status: DeviceStatus.ACTIVE },
        },
      },
      include: { roomType: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  });
});
