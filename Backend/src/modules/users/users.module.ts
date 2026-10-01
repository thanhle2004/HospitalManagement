import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { StaffController } from './staff.controller';

@Module({
  imports: [ActivityLogModule],
  controllers: [UsersController, StaffController],
  providers: [UsersService, UsersRepository],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
