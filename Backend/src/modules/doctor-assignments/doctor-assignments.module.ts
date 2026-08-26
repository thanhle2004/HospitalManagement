import { Module } from '@nestjs/common';
import { DoctorAssignmentsController } from './doctor-assignments.controller';
import { DoctorAssignmentsService } from './doctor-assignments.service';
import { DoctorAssignmentsRepository } from './repositories/doctor-assignments.repository';
import { UsersModule } from '../users/users.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [UsersModule, RoomsModule], // validate doctorId (role=DOCTOR) và roomId tồn tại
  controllers: [DoctorAssignmentsController],
  providers: [DoctorAssignmentsService, DoctorAssignmentsRepository],
  exports: [DoctorAssignmentsRepository],
})
export class DoctorAssignmentsModule {}
