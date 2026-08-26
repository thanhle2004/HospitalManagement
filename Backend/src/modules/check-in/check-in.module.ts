import { Module } from '@nestjs/common';
import { CheckInController } from './check-in.controller';
import { CheckInService } from './check-in.service';
import { RoomQueueEntriesRepository } from './repositories/room-queue-entries.repository';
import { CheckInLogsRepository } from './repositories/check-in-logs.repository';
import { DevicesModule } from '../devices/devices.module';
import { RoutingModule } from '../routing/routing.module';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [
    DevicesModule, // DevicesRepository
    RoutingModule, // VisitTokensRepository, VisitAssignmentsRepository
    VisitsModule, // VisitStepsRepository
  ],
  controllers: [CheckInController],
  providers: [CheckInService, RoomQueueEntriesRepository, CheckInLogsRepository],
  exports: [RoomQueueEntriesRepository],
})
export class CheckInModule {}
