import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeviceAuthService } from './device-auth.service';
import { DeviceLoginDto } from './dto/device-login.dto';
import { DeviceTokenResponseDto } from './dto/device-token-response.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Device Auth')
@Public() // Toàn bộ controller này bỏ qua JwtAuthGuard (Staff, global)
@Controller('device-auth')
export class DeviceAuthController {
  constructor(private readonly deviceAuthService: DeviceAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thiết bị Android đăng nhập bằng code + secret' })
  @ApiOkResponse({ type: DeviceTokenResponseDto })
  login(@Body() dto: DeviceLoginDto) {
    return this.deviceAuthService.login(dto);
  }
}
