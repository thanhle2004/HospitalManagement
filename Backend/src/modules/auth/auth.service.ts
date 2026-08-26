import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { hashToken } from './utils/hash-token.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.status !== UserStatus.ACTIVE) {
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

    return this.issueTokens(user.id, user.email, user.role);
  }

  /**
   * Refresh token rotation: mỗi lần refresh, token cũ bị revoke ngay và
   * cấp token mới — nếu 1 refresh token bị đánh cắp và dùng lại sau khi đã
   * bị rotate, request đó sẽ fail vì token cũ không còn "valid" trong DB.
   */
  async refresh(dto: RefreshTokenDto): Promise<TokenResponseDto> {
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

    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.refreshTokenRepository.findValid(
      payload.sub,
      tokenHash,
    );
    if (!stored) {
      throw new UnauthorizedException(
        'Refresh token đã bị thu hồi hoặc không tồn tại',
      );
    }

    await this.refreshTokenRepository.revoke(stored.id);

    const user = await this.usersRepository.findById(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Tài khoản không còn hoạt động');
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(userId: string): Promise<void> {
    await this.refreshTokenRepository.revokeAllForUser(userId);
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<TokenResponseDto> {
    const payload: JwtPayload = { sub: userId, email, role };

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
      }),
    ]);

    await this.refreshTokenRepository.create({
      user: { connect: { id: userId } },
      tokenHash: hashToken(refreshToken),
      expiresAt: this.computeExpiryDate(refreshExpiresIn),
    });

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
