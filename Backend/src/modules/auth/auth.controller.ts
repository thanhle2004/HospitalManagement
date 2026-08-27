import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import type { Request } from 'express';
import { AuthRateLimitService } from '../../common/security/auth-rate-limit.service';
import { getClientAddress } from '../../common/http/client-address.util';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập Admin/Doctor bằng email + password' })
  @ApiOkResponse({ type: TokenResponseDto })
  login(@Req() request: Request, @Body() dto: LoginDto) {
    this.limitLogin(request, dto.email);
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cấp access token mới từ refresh token (có rotation)' })
  @ApiOkResponse({ type: TokenResponseDto })
  refresh(@Req() request: Request, @Body() dto: RefreshTokenDto) {
    this.limitRefresh(request, dto.refreshToken);
    return this.authService.refresh(dto);
  }

  // Không @Public() => JwtAuthGuard global tự yêu cầu access token hợp lệ
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke toàn bộ refresh token của user hiện tại' })
  async logout(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.authService.logout(user.sub);
  }

  private limitLogin(request: Request, email: string): void {
    const address = getClientAddress(request);
    this.rateLimit.assertAllowed('staff-login-ip', [address], 20, 60_000);
    this.rateLimit.assertAllowed('staff-login-identity', [email], 5, 60_000);
  }

  private limitRefresh(request: Request, refreshToken: string): void {
    const address = getClientAddress(request);
    this.rateLimit.assertAllowed('staff-refresh-ip', [address], 60, 60_000);
    this.rateLimit.assertAllowed(
      'staff-refresh-token',
      [refreshToken],
      10,
      60_000,
    );
  }
}
