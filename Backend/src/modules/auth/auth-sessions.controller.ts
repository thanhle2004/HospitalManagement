import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { getClientAddress } from '../../common/http/client-address.util';
import { AuthRateLimitService } from '../../common/security/auth-rate-limit.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { StaffSessionResponseDto } from './dto/staff-session-response.dto';
import { StaffCurrentSessionEnvelopeDto } from './dto/staff-current-session.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RbacService } from '../rbac/rbac.service';
import { getRequestId, RequestWithContext } from '../../common/http/request-context';

@ApiTags('Auth Sessions v1')
@Controller('api/v1/auth/sessions')
export class AuthSessionsController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly rbacService: RbacService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạo phiên Staff v1; phản hồi ẩn trạng thái tài khoản' })
  @ApiOkResponse({ type: TokenResponseDto })
  login(@Req() request: RequestWithContext, @Body() dto: LoginDto) {
    this.limitLogin(request, dto.email);
    return this.authService.login(dto, true, this.context(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token cho phiên Staff v1' })
  @ApiOkResponse({ type: TokenResponseDto })
  refresh(@Req() request: RequestWithContext, @Body() dto: RefreshTokenDto) {
    this.limitRefresh(request, dto.refreshToken);
    return this.authService.refresh(dto, this.context(request));
  }

  @Get('current')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đọc Staff hiện tại sau khi token đã đối chiếu DB' })
  @ApiOkResponse({ type: StaffCurrentSessionEnvelopeDto })
  async current(@CurrentUser() user: JwtPayload) {
    const [staff, access] = await Promise.all([
      this.usersService.findById(user.sub),
      this.rbacService.getEffectiveAccess(user.sub, user.role),
    ]);
    return { ...staff, ...access };
  }

  @Delete('current')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thu hồi toàn bộ phiên Staff và tăng token version' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() request: RequestWithContext,
  ): Promise<void> {
    await this.authService.logout(user.sub, this.auditContext(request));
  }

  @Get('active')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Liệt kê các phiên Staff đang hoạt động' })
  @ApiOkResponse({ type: StaffSessionResponseDto, isArray: true })
  list(@CurrentUser() user: JwtPayload) {
    return this.authService.listSessions(user.sub, user.sid);
  }

  @Delete('others')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thu hồi mọi phiên Staff trừ phiên hiện tại' })
  revokeOthers(
    @CurrentUser() user: JwtPayload,
    @Req() request: RequestWithContext,
  ) {
    return this.authService.revokeOtherSessions(user.sub, user.sid, this.auditContext(request));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thu hồi một phiên Staff thuộc tài khoản hiện tại' })
  revokeOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Req() request: RequestWithContext,
  ) {
    return this.authService.revokeSession(user.sub, id, this.auditContext(request));
  }

  private context(request: RequestWithContext) {
    return {
      requestId: getRequestId(request),
      ipAddress: getClientAddress(request),
      deviceInfo: request.headers['user-agent'],
      userAgent: request.headers['user-agent'],
    };
  }

  private auditContext(request: RequestWithContext) {
    return {
      requestId: getRequestId(request),
      ipAddress: getClientAddress(request),
      userAgent: request.headers['user-agent'],
    };
  }

  private limitLogin(request: RequestWithContext, email: string): void {
    const address = getClientAddress(request);
    this.rateLimit.assertAllowed('staff-login-ip', [address], 20, 60_000);
    this.rateLimit.assertAllowed('staff-login-identity', [email], 5, 60_000);
  }

  private limitRefresh(request: RequestWithContext, refreshToken: string): void {
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
