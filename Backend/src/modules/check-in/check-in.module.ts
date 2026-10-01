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
  // [Simulator Phase 2] Thêm CheckInService — PatientGenerator (mô-đun
  // simulation) gọi thẳng service này trong tiến trình để giả lập bệnh nhân
  // quét QR, thay vì đi qua HTTP (xem docs/simulator-architecture.md §4.2).
  exports: [RoomQueueEntriesRepository, CheckInService],
})
export class CheckInModule {}