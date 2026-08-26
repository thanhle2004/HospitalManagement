import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PatientJwtPayload } from '../interfaces/patient-jwt-payload.interface';

@Injectable()
export class PatientJwtStrategy extends PassportStrategy(
  Strategy,
  'patient-jwt', // đặt tên riêng — không đụng độ với strategy 'jwt' mặc định của Staff
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.patientAccessSecret')!,
    });
  }

  validate(payload: PatientJwtPayload): PatientJwtPayload {
    return payload;
  }
}
