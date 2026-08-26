import { ActivityLog } from '@prisma/client';
import { ActivityLogResponseDto } from './dto/activity-log-response.dto';

export class ActivityLogsMapper {
  static toResponseDto(log: ActivityLog): ActivityLogResponseDto {
    return {
      id: log.id.toString(), // BigInt -> string
      userId: log.userId,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
      createdAt: log.createdAt,
    };
  }

  static toResponseDtoList(logs: ActivityLog[]): ActivityLogResponseDto[] {
    return logs.map((l) => this.toResponseDto(l));
  }
}
