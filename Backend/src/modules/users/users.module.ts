import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { StaffController } from './staff.controller';
import { StaffSessionPersistenceModule } from '../auth/staff-session-persistence.module';

@Module({
  imports: [ActivityLogModule, StaffSessionPersistenceModule],
  controllers: [UsersController, StaffController],
  providers: [UsersService, UsersRepository],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
