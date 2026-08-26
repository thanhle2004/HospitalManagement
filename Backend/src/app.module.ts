import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { PatientsModule } from './modules/patients/patients.module';
import { PatientAuthModule } from './modules/patient-auth/patient-auth.module';
import { RoomTypesModule } from './modules/room-types/room-types.module';
import { PatientTypesModule } from './modules/patient-types/patient-types.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { DevicesModule } from './modules/devices/devices.module';
import { DoctorAssignmentsModule } from './modules/doctor-assignments/doctor-assignments.module';
import { FlowsModule } from './modules/flows/flows.module';
import { VisitsModule } from './modules/visits/visits.module';
import { RoutingModule } from './modules/routing/routing.module';
import { DeviceAuthModule } from './modules/device-auth/device-auth.module';
import { CheckInModule } from './modules/check-in/check-in.module';
import { DoctorModule } from './modules/doctor/doctor.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { AdminQueueModule } from './modules/admin-queue/admin-queue.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    // Cho phép module này emit/lắng nghe event nội bộ (vd VisitsModule ->
    // RoutingModule khi 1 VisitStep chuyển READY) mà không cần import
    // module lẫn nhau — tránh circular dependency.
    EventEmitterModule.forRoot(),
    // Bật @Cron() decorator — RoutingEngineService dùng để retry định kỳ
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    PatientAuthModule,
    RoomTypesModule,
    PatientTypesModule,
    RoomsModule,
    DevicesModule,
    DoctorAssignmentsModule,
    FlowsModule,
    VisitsModule,
    RoutingModule,
    DeviceAuthModule,
    CheckInModule,
    DoctorModule,
    RealtimeModule,
    ActivityLogModule,
    AdminQueueModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Validate toàn bộ @Body()/@Query()/@Param() có kiểu là zod DTO (createZodDto)
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Áp dụng cho MỌI route trong app — mặc định yêu cầu JWT hợp lệ.
    // Route nào không cần đăng nhập thì đánh dấu @Public() (vd /auth/login, /health).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Chạy sau JwtAuthGuard — kiểm tra role nếu route có @Roles(...).
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
