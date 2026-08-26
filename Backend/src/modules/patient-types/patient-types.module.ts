import { Module } from '@nestjs/common';
import { PatientTypesController } from './patient-types.controller';
import { PatientTypesService } from './patient-types.service';
import { PatientTypesRepository } from './patient-types.repository';

@Module({
  controllers: [PatientTypesController],
  providers: [PatientTypesService, PatientTypesRepository],
  exports: [PatientTypesRepository],
})
export class PatientTypesModule {}
