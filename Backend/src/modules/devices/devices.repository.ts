import { Injectable } from '@nestjs/common';
import { Device, DeviceStatus, Prisma, Room } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;
export type DeviceWithRoom = Device & { room: Room };

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string, db: Db = this.prisma): Promise<Device | null> {
    return db.device.findUnique({ where: { code } });
  }

  create(data: Prisma.DeviceCreateInput, db: Db = this.prisma): Promise<Device> {
    return db.device.create({ data });
  }

  findAll(
    filter: { roomId?: number },
    db: Db = this.prisma,
  ): Promise<DeviceWithRoom[]> {
    return db.device.findMany({
      where: { roomId: filter.roomId },
      include: { room: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string, db: Db = this.prisma): Promise<DeviceWithRoom | null> {
    return db.device.findUnique({ where: { id }, include: { room: true } });
  }

  update(
    id: string,
    data: Prisma.DeviceUpdateInput,
    db: Db = this.prisma,
  ): Promise<Device> {
    return db.device.update({ where: { id }, data });
  }

  updateStatus(
    id: string,
    status: DeviceStatus,
    db: Db = this.prisma,
  ): Promise<Device> {
    return db.device.update({ where: { id }, data: { status } });
  }

  updateSecret(
    id: string,
    secretKeyHash: string,
    db: Db = this.prisma,
  ): Promise<Device> {
    return db.device.update({ where: { id }, data: { secretKeyHash } });
  }
}
