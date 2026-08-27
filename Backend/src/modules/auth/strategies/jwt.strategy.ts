import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersRepository } from '../../users/users.repository';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret')!,
    });
  }

  /** Giá trị return được gắn vào request.user */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersRepository.findById(payload.sub);
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      (payload.tokenVersion ?? 0) !== user.tokenVersion
    ) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }

    return {
      sub: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
  }
}
