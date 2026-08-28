import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PatientAuthController } from './patient-auth.controller';
import { PatientAuthService } from './patient-auth.service';
import { PatientJwtStrategy } from './strategies/patient-jwt.strategy';
import { PatientOtpRepository } from './repositories/patient-otp.repository';
import { PatientSessionRepository } from './repositories/patient-session.repository';
import { OtpSenderService } from './otp-sender.service';
import { PatientsModule } from '../patients/patients.module';
import { PatientAuthChallengesController } from './patient-auth-challenges.controller';
import { FirebasePhoneAuthService } from './firebase-phone-auth.service';

@Module({
  imports: [
    PatientsModule, // để dùng PatientsRepository (đã export)
    PassportModule,
    // Không cần secret/signOptions mặc định ở đây — PatientAuthService luôn
    // truyền secret riêng (jwt.patientAccessSecret/patientRefreshSecret)
    // cho từng lần sign/verify, khác với secret của Staff.
    JwtModule.register({}),
  ],
  controllers: [PatientAuthController, PatientAuthChallengesController],
  providers: [
    PatientAuthService,
    PatientJwtStrategy,
    PatientOtpRepository,
    PatientSessionRepository,
    OtpSenderService,
    FirebasePhoneAuthService,
  ],
})
export class PatientAuthModule {}
