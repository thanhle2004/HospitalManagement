import { Injectable } from '@nestjs/common';
import { Prisma, RoomType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class RoomTypesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.RoomTypeCreateInput, db: Db = this.prisma): Promise<RoomType> {
    return db.roomType.create({ data });
  }

  findAll(db: Db = this.prisma): Promise<RoomType[]> {
    return db.roomType.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  findById(id: number, db: Db = this.prisma): Promise<RoomType | null> {
    return db.roomType.findFirst({ where: { id, deletedAt: null } });
  }

  update(
    id: number,
    data: Prisma.RoomTypeUpdateInput,
    db: Db = this.prisma,
  ): Promise<RoomType> {
    return db.roomType.update({ where: { id }, data });
  }

  softDelete(id: number, db: Db = this.prisma): Promise<RoomType> {
    return db.roomType.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
