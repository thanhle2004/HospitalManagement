import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PatientsRepository } from '../../patients/patients.repository';
import { PatientJwtPayload } from '../interfaces/patient-jwt-payload.interface';

@Injectable()
export class PatientJwtStrategy extends PassportStrategy(
  Strategy,
  'patient-jwt', // đặt tên riêng — không đụng độ với strategy 'jwt' mặc định của Staff
) {
  constructor(
    configService: ConfigService,
    private readonly patientsRepository: PatientsRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.patientAccessSecret')!,
    });
  }

  async validate(payload: PatientJwtPayload): Promise<PatientJwtPayload> {
    const patient = await this.patientsRepository.findById(payload.sub);
    if (
      !patient ||
      (payload.tokenVersion ?? 0) !== patient.tokenVersion
    ) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }

    return { sub: patient.id, tokenVersion: patient.tokenVersion };
  }
}
