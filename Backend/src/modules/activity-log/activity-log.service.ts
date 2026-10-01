import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogsRepository } from './activity-logs.repository';
import { ActivityLogsMapper } from './activity-logs.mapper';
import { FindActivityLogsQueryDto } from './dto/find-activity-logs-query.dto';
import { PaginatedActivityLogResponseDto } from './dto/activity-log-response.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ACTION_CATALOG, AuditActionCode, AuditMetadataSchema } from './audit-action.catalog';

type Db = PrismaService | Prisma.TransactionClient;

export interface LogActivityParams {
  userId?: string;
  action: AuditActionCode;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface SensitiveReadParams {
  userId: string;
  action: AuditActionCode;
  entity: string;
  entityId: string;
  effectiveRoles: string[];
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  resultCount?: number;
  filterFields?: string[];
}

@Injectable()
export class ActivityLogService {
  constructor(private readonly activityLogsRepository: ActivityLogsRepository) {}

  /**
   * Helper dùng chung — bất kỳ module nào cần ghi audit chỉ cần import
   * ActivityLogModule rồi gọi log(...), không cần biết chi tiết Prisma bên dưới.
   */
  async log(params: LogActivityParams, db?: Db): Promise<void> {
    const policy = AUDIT_ACTION_CATALOG[params.action];
    if (policy.resource !== params.entity) {
      throw new Error(`Audit action ${params.action} requires resource ${policy.resource}`);
    }
    const compactMetadata = Object.fromEntries(
      Object.entries(params.metadata ?? {}).filter(([, value]) => value !== undefined),
    );
    const metadata = AuditMetadataSchema.parse(compactMetadata);
    if (policy.reasonRequired && !metadata.reason) {
      throw new Error(`Audit action ${params.action} requires reason metadata`);
    }
    await this.activityLogsRepository.create({
      user: params.userId ? { connect: { id: params.userId } } : undefined,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      metadata: metadata as Prisma.InputJsonValue,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    }, db);
  }

  async logBestEffort(params: LogActivityParams): Promise<void> {
    try {
      await this.log(params);
    } catch {
      // Authentication failures must keep a stable anti-enumeration response even if audit storage is unavailable.
    }
  }

  async logSensitiveRead(params: SensitiveReadParams): Promise<void> {
    const policy = AUDIT_ACTION_CATALOG[params.action];
    if (!policy.sensitiveRead) {
      throw new Error(`Audit action ${params.action} is not a sensitive-read policy`);
    }
    await this.log({
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      metadata: {
        requestId: params.requestId,
        effectiveRoles: [...params.effectiveRoles].sort(),
        resultCount: params.resultCount,
        filterFields: params.filterFields,
      },
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
      action: query.action,
      createdAt: query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
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
