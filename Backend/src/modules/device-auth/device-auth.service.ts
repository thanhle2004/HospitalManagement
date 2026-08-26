import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DeviceStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DevicesRepository } from '../devices/devices.repository';
import { DeviceLoginDto } from './dto/device-login.dto';
import { DeviceTokenResponseDto } from './dto/device-token-response.dto';
import { DeviceJwtPayload } from './interfaces/device-jwt-payload.interface';

@Injectable()
export class DeviceAuthService {
  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: DeviceLoginDto): Promise<DeviceTokenResponseDto> {
    const device = await this.devicesRepository.findByCode(dto.code);
    if (!device) {
      throw new UnauthorizedException('Code hoặc secret không đúng');
    }

    if (device.status !== DeviceStatus.ACTIVE) {
      throw new ForbiddenException('Thiết bị đã bị vô hiệu hoá — liên hệ Admin');
    }

    const matches = await bcrypt.compare(dto.secret, device.secretKeyHash);
    if (!matches) {
      throw new UnauthorizedException('Code hoặc secret không đúng');
    }

    // Đăng nhập thành công = tín hiệu thiết bị "còn sống" — tiện thể cập nhật heartbeat
    await this.devicesRepository.update(device.id, {
      lastHeartbeatAt: new Date(),
    });

    const payload: DeviceJwtPayload = { sub: device.id, code: device.code };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.deviceAccessSecret'),
      expiresIn: this.configService.get<string>('jwt.deviceAccessExpiresIn'),
    });

    return { accessToken };
  }
}
