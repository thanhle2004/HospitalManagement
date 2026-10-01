import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingEngineService } from './routing-engine.service';
import { VisitAssignmentsRepository } from './repositories/visit-assignments.repository';
import { VisitTokensRepository } from './repositories/visit-tokens.repository';
import { RoutingDecisionsRepository } from './repositories/routing-decisions.repository';
import { RoutingStrategyRegistry } from './strategies/routing-strategy.registry';
import { VisitsModule } from '../visits/visits.module';
import { RoomsModule } from '../rooms/rooms.module';
import { RoomTypesModule } from '../room-types/room-types.module';

@Module({
  imports: [
    VisitsModule, // VisitStepsRepository, RoutingQueueRepository, VisitsRepository (Phase 3: tra simulationRunId)
    RoomsModule, // RoomsRepository.findActiveByRoomType
    RoomTypesModule, // RoomTypesRepository (avgProcessTime)
  ],
  controllers: [RoutingController],
  providers: [
    RoutingEngineService,
    VisitAssignmentsRepository,
    VisitTokensRepository,
    RoutingDecisionsRepository, // [Phase 3] Routing Decision Log — bảng production, xem docs/simulator-architecture.md §6
    RoutingStrategyRegistry, // [Phase 3] xem docs/simulator-architecture.md §5.1
  ],
  exports: [VisitAssignmentsRepository, VisitTokensRepository, RoutingDecisionsRepository],
})
export class RoutingModule {}