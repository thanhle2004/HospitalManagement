import { Module } from '@nestjs/common';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { FlowStepsService } from './flow-steps.service';
import { FlowDependenciesService } from './flow-dependencies.service';
import { FlowsRepository } from './repositories/flows.repository';
import { FlowStepsRepository } from './repositories/flow-steps.repository';
import { FlowDependenciesRepository } from './repositories/flow-dependencies.repository';
import { RoomTypesModule } from '../room-types/room-types.module';

@Module({
  imports: [RoomTypesModule], // validate roomTypeId tồn tại khi tạo FlowStep
  controllers: [FlowsController],
  providers: [
    FlowsService,
    FlowStepsService,
    FlowDependenciesService,
    FlowsRepository,
    FlowStepsRepository,
    FlowDependenciesRepository,
  ],
  exports: [FlowsRepository, FlowStepsRepository, FlowDependenciesRepository],
})
export class FlowsModule {}
