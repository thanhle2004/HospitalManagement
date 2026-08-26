import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingEngineService } from './routing-engine.service';
import { VisitAssignmentsRepository } from './repositories/visit-assignments.repository';
import { VisitTokensRepository } from './repositories/visit-tokens.repository';
import { VisitsModule } from '../visits/visits.module';
import { RoomsModule } from '../rooms/rooms.module';
import { RoomTypesModule } from '../room-types/room-types.module';

@Module({
  imports: [
    VisitsModule, // VisitStepsRepository, RoutingQueueRepository
    RoomsModule, // RoomsRepository.findActiveByRoomType
    RoomTypesModule, // RoomTypesRepository (avgProcessTime)
  ],
  controllers: [RoutingController],
  providers: [
    RoutingEngineService,
    VisitAssignmentsRepository,
    VisitTokensRepository,
  ],
  exports: [VisitAssignmentsRepository, VisitTokensRepository],
})
export class RoutingModule {}
