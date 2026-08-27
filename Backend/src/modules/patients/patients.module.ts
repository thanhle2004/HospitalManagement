import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PatientsRepository } from './patients.repository';
import { AdminPatientsController } from './admin-patients.controller';
import { PatientTypesModule } from '../patient-types/patient-types.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [PatientTypesModule, ActivityLogModule],
  controllers: [PatientsController, AdminPatientsController],
  providers: [PatientsService, PatientsRepository],
  exports: [PatientsRepository],
})
export class PatientsModule {}
