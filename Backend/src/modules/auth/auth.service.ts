import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from '../users/users.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { hashToken } from './utils/hash-token.util';
import { ActivityLogService } from '../activity-log/activity-log.service';

export interface AuthAuditContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async login(
    dto: LoginDto,
    concealAccountState = false,
    context: { ipAddress?: string; deviceInfo?: string } = {},
  ): Promise<TokenResponseDto> {
    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.status !== UserStatus.ACTIVE) {
      if (concealAccountState) {
        throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
      }
      throw new ForbiddenException(
        'Tài khoản đã bị khoá hoặc vô hiệu hoá — liên hệ Admin',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    await this.usersRepository.updateLastLogin(user.id);

    return this.issueTokens(
      user.id,
      user.role,
      user.tokenVersion,
      undefined,
      context,
    );
  }

  /**
   * Refresh token rotation: mỗi lần refresh, token cũ bị revoke ngay và
   * cấp token mới — nếu 1 refresh token bị đánh cắp và dùng lại sau khi đã
   * bị rotate, request đó sẽ fail vì token cũ không còn "valid" trong DB.
   */
  async refresh(
    dto: RefreshTokenDto,
    context: { ipAddress?: string; deviceInfo?: string } = {},
  ): Promise<TokenResponseDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        { secret: this.configService.get<string>('jwt.refreshSecret') },
      );
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    return this.prisma.transaction(async (tx) => {
      const tokenHash = hashToken(dto.refreshToken);
      const user = await this.usersRepository.findById(payload.sub, tx);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException('Tài khoản không còn hoạt động');
      }
      if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
        throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
      }

      const consumed = await this.refreshTokenRepository.consumeValid(
        payload.sub,
        tokenHash,
        tx,
      );
      if (consumed.count < 1) {
        throw new UnauthorizedException(
          'Refresh token đã bị thu hồi hoặc đã được sử dụng',
        );
      }

      return this.issueTokens(
        user.id,
        user.role,
        user.tokenVersion,
        tx,
        context,
      );
    });
  }

  async logout(userId: string, context: AuthAuditContext = {}): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      await this.refreshTokenRepository.revokeAllForUser(userId, tx);
      await this.usersRepository.incrementTokenVersion(userId, tx);
      await this.activityLogService.log(
        {
          userId,
          action: 'STAFF_LOGGED_OUT_ALL',
          entity: 'User',
          entityId: userId,
          metadata: { requestId: context.requestId },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
        tx,
      );
    });
  }

  listSessions(userId: string, currentSessionId?: string) {
    return this.refreshTokenRepository.findActiveForUser(userId).then((items) =>
      items.map((item) => ({ ...item, current: item.id === currentSessionId })),
    );
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    context: AuthAuditContext = {},
  ): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      const result = await this.refreshTokenRepository.revokeById(
        userId,
        sessionId,
        tx,
      );
      if (!result.count) {
        throw new UnauthorizedException('Phiên không tồn tại hoặc đã bị thu hồi');
      }
      await this.activityLogService.log(
        {
          userId,
          action: 'STAFF_SESSION_REVOKED',
          entity: 'RefreshToken',
          entityId: sessionId,
          metadata: { requestId: context.requestId },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
        tx,
      );
    });
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId?: string,
    context: AuthAuditContext = {},
  ): Promise<void> {
    if (!currentSessionId) {
      throw new UnauthorizedException(
        'Phiên legacy không hỗ trợ thao tác này',
      );
    }
    await this.prisma.transaction(async (tx) => {
      const result = await this.refreshTokenRepository.revokeOthers(
        userId,
        currentSessionId,
        tx,
      );
      await this.activityLogService.log(
        {
          userId,
          action: 'STAFF_OTHER_SESSIONS_REVOKED',
          entity: 'User',
          entityId: userId,
          metadata: { requestId: context.requestId, affectedCount: result.count },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
        tx,
      );
    });
  }

  private async issueTokens(
    userId: string,
    role: UserRole,
    tokenVersion: number,
    db?: Prisma.TransactionClient,
    context: { ipAddress?: string; deviceInfo?: string } = {},
  ): Promise<TokenResponseDto> {
    const sessionId = randomUUID();
    const payload: JwtPayload = {
      sub: userId,
      role,
      tokenVersion,
      sid: sessionId,
    };

    const accessExpiresIn = this.configService.get<string>(
      'jwt.accessExpiresIn',
    )!;
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    )!;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
        jwtid: randomUUID(),
      }),
    ]);

    await this.refreshTokenRepository.create(
      {
        id: sessionId,
        user: { connect: { id: userId } },
        tokenHash: hashToken(refreshToken),
        expiresAt: this.computeExpiryDate(refreshExpiresIn),
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        lastUsedAt: new Date(),
      },
      db,
    );

    return { accessToken, refreshToken };
  }

  /** Parse chuỗi kiểu "15m" / "7d" / "1h" (cùng format với jsonwebtoken expiresIn) */
  private computeExpiryDate(expiresIn: string): Date {
    const match = /^(\d+)(s|m|h|d)$/.exec(expiresIn);
    const now = Date.now();

    if (!match) {
      return new Date(now + 7 * 24 * 60 * 60 * 1000); // fallback an toàn: 7 ngày
    }

    const value = parseInt(match[1], 10);
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    return new Date(now + value * unitMs[match[2]]);
  }
}
