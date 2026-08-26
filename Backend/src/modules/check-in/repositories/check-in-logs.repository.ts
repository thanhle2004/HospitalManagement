import { Injectable } from '@nestjs/common';
import { CheckInLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CheckInLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.CheckInLogCreateInput,
    db: Db = this.prisma,
  ): Promise<CheckInLog> {
    return db.checkInLog.create({ data });
  }
}
