import { Module } from '@nestjs/common';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';
import { DoctorAssignmentsModule } from '../doctor-assignments/doctor-assignments.module';
import { RoutingModule } from '../routing/routing.module';
import { CheckInModule } from '../check-in/check-in.module';
import { RoomsModule } from '../rooms/rooms.module';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [
    DoctorAssignmentsModule, // DoctorAssignmentsRepository.findActiveRoomIdsForDoctor
    RoutingModule, // VisitAssignmentsRepository
    CheckInModule, // RoomQueueEntriesRepository
    RoomsModule, // RoomRuntimeRepository
    VisitsModule, // VisitStepsRepository + VisitsService.resolveDependenciesAndCheckCompletion
  ],
  controllers: [DoctorController],
  providers: [DoctorService],
})
export class DoctorModule {}
