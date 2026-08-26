import { Injectable } from '@nestjs/common';
import { ActivityLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

export interface ActivityLogFilter {
  entity?: string;
  entityId?: string;
  userId?: string;
}

@Injectable()
export class ActivityLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.ActivityLogCreateInput,
    db: Db = this.prisma,
  ): Promise<ActivityLog> {
    return db.activityLog.create({ data });
  }

  findAll(
    filter: ActivityLogFilter,
    skip: number,
    take: number,
    db: Db = this.prisma,
  ): Promise<ActivityLog[]> {
    return db.activityLog.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  count(filter: ActivityLogFilter, db: Db = this.prisma): Promise<number> {
    return db.activityLog.count({ where: filter });
  }
}
