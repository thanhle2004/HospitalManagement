import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { DeviceStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DevicesRepository } from '../../devices/devices.repository';
import { DeviceJwtPayload } from '../interfaces/device-jwt-payload.interface';

@Injectable()
export class DeviceJwtStrategy extends PassportStrategy(Strategy, 'device-jwt') {
  constructor(
    configService: ConfigService,
    private readonly devicesRepository: DevicesRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.deviceAccessSecret')!,
    });
  }

  async validate(payload: DeviceJwtPayload): Promise<DeviceJwtPayload> {
    const device = await this.devicesRepository.findById(payload.sub);
    if (
      !device ||
      device.status !== DeviceStatus.ACTIVE ||
      (payload.tokenVersion ?? 0) !== device.tokenVersion
    ) {
      throw new UnauthorizedException('Phiên thiết bị không còn hiệu lực');
    }

    return { sub: device.id, tokenVersion: device.tokenVersion };
  }
}
