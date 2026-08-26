import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogsRepository } from './activity-logs.repository';
import { ActivityLogsMapper } from './activity-logs.mapper';
import { FindActivityLogsQueryDto } from './dto/find-activity-logs-query.dto';
import { PaginatedActivityLogResponseDto } from './dto/activity-log-response.dto';

export interface LogActivityParams {
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ActivityLogService {
  constructor(private readonly activityLogsRepository: ActivityLogsRepository) {}

  /**
   * Helper dùng chung — bất kỳ module nào cần ghi audit chỉ cần import
   * ActivityLogModule rồi gọi log(...), không cần biết chi tiết Prisma bên dưới.
   */
  async log(params: LogActivityParams): Promise<void> {
    await this.activityLogsRepository.create({
      user: params.userId ? { connect: { id: params.userId } } : undefined,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  async findAll(
    query: FindActivityLogsQueryDto,
  ): Promise<PaginatedActivityLogResponseDto> {
    const filter = {
      entity: query.entity,
      entityId: query.entityId,
      userId: query.userId,
    };
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.activityLogsRepository.findAll(filter, skip, query.limit),
      this.activityLogsRepository.count(filter),
    ]);

    return {
      items: ActivityLogsMapper.toResponseDtoList(items),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
