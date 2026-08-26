import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { VisitsModule } from '../visits/visits.module';
import { DoctorAssignmentsModule } from '../doctor-assignments/doctor-assignments.module';

@Module({
  imports: [
    VisitsModule, // VisitsRepository (tra patientId từ visitId)
    DoctorAssignmentsModule, // DoctorAssignmentsRepository (tra phòng Doctor đang trực)
    JwtModule.register({}), // secret luôn truyền riêng theo từng lần verify (Staff/Patient khác nhau)
  ],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
