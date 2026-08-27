import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { getClientAddress } from '../../common/http/client-address.util';
import { AuthRateLimitService } from '../../common/security/auth-rate-limit.service';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('Auth Sessions v1')
@Controller('api/v1/auth/sessions')
export class AuthSessionsController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạo phiên Staff v1; phản hồi ẩn trạng thái tài khoản' })
  @ApiOkResponse({ type: TokenResponseDto })
  login(@Req() request: Request, @Body() dto: LoginDto) {
    this.limitLogin(request, dto.email);
    return this.authService.login(dto, true);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token cho phiên Staff v1' })
  @ApiOkResponse({ type: TokenResponseDto })
  refresh(@Req() request: Request, @Body() dto: RefreshTokenDto) {
    this.limitRefresh(request, dto.refreshToken);
    return this.authService.refresh(dto);
  }

  @Get('current')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đọc Staff hiện tại sau khi token đã đối chiếu DB' })
  @ApiOkResponse({ type: UserResponseDto })
  current(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @Delete('current')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thu hồi toàn bộ phiên Staff và tăng token version' })
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
