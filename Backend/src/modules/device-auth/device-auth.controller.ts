import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeviceAuthService } from './device-auth.service';
import { DeviceLoginDto } from './dto/device-login.dto';
import { DeviceTokenResponseDto } from './dto/device-token-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import type { Request } from 'express';
import { AuthRateLimitService } from '../../common/security/auth-rate-limit.service';
import { getClientAddress } from '../../common/http/client-address.util';

@ApiTags('Device Auth')
@Public() // Toàn bộ controller này bỏ qua JwtAuthGuard (Staff, global)
@Controller('device-auth')
export class DeviceAuthController {
  constructor(
    private readonly deviceAuthService: DeviceAuthService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thiết bị Android đăng nhập bằng code + secret' })
  @ApiOkResponse({ type: DeviceTokenResponseDto })
  login(@Req() request: Request, @Body() dto: DeviceLoginDto) {
    const address = getClientAddress(request);
    this.rateLimit.assertAllowed('device-login-ip', [address], 30, 60_000);
    this.rateLimit.assertAllowed(
      'device-login-code',
      [dto.code],
      10,
      60_000,
    );
    return this.deviceAuthService.login(dto);
  }
}
