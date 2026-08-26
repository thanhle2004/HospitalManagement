import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DeviceAuthController } from './device-auth.controller';
import { DeviceAuthService } from './device-auth.service';
import { DeviceJwtStrategy } from './strategies/device-jwt.strategy';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [
    DevicesModule, // DevicesRepository
    PassportModule,
    JwtModule.register({}), // secret luôn truyền riêng theo từng lần sign/verify
  ],
  controllers: [DeviceAuthController],
  providers: [DeviceAuthService, DeviceJwtStrategy],
})
export class DeviceAuthModule {}
