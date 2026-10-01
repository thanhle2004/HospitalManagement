import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AuthSessionsController } from './auth-sessions.controller';
import { RbacModule } from '../rbac/rbac.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { StaffSessionPersistenceModule } from './staff-session-persistence.module';

@Module({
  imports: [
    UsersModule, // để dùng UsersRepository (đã export ở UsersModule)
    RbacModule,
    ActivityLogModule,
    StaffSessionPersistenceModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: { expiresIn: config.get<string>('jwt.accessExpiresIn') },
      }),
    }),
  ],
  controllers: [AuthController, AuthSessionsController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
