import { Module } from '@nestjs/common';
import { AdminQueueController } from './admin-queue.controller';
import { AdminQueueService } from './admin-queue.service';
import { CheckInModule } from '../check-in/check-in.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    CheckInModule, // RoomQueueEntriesRepository
    ActivityLogModule, // ActivityLogService.log()
  ],
  controllers: [AdminQueueController],
  providers: [AdminQueueService],
})
export class AdminQueueModule {}
