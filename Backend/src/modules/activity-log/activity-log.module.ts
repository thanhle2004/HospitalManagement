import { Module } from '@nestjs/common';
import { ActivityLogController } from './activity-log.controller';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogsRepository } from './activity-logs.repository';

@Module({
  controllers: [ActivityLogController],
  providers: [ActivityLogService, ActivityLogsRepository],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
