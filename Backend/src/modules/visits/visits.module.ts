import { Module } from '@nestjs/common';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';
import { VisitsRepository } from './repositories/visits.repository';
import { VisitStepsRepository } from './repositories/visit-steps.repository';
import { VisitStepDependenciesRepository } from './repositories/visit-step-dependencies.repository';
import { RoutingQueueRepository } from './repositories/routing-queue.repository';
import { FlowsModule } from '../flows/flows.module';
import { RoomTypesModule } from '../room-types/room-types.module';

@Module({
  imports: [
    FlowsModule, // dùng FlowsRepository.findByIdWithGraph để copy sang VisitStep
    RoomTypesModule, // validate roomTypeId khi Doctor thêm bước ad-hoc
  ],
  controllers: [VisitsController],
  providers: [
    VisitsService,
    VisitsRepository,
    VisitStepsRepository,
    VisitStepDependenciesRepository,
    RoutingQueueRepository,
  ],
  exports: [
    VisitsService, // DoctorModule gọi resolveDependenciesAndCheckCompletion()
    VisitsRepository,
    VisitStepsRepository,
    VisitStepDependenciesRepository,
    RoutingQueueRepository,
  ],
})
export class VisitsModule {}
