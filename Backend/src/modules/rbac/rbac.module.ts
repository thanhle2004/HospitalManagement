import { Module } from '@nestjs/common';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { RbacController } from './rbac.controller';
import { RbacRepository } from './rbac.repository';
import { RbacService } from './rbac.service';

@Module({
  imports: [ActivityLogModule],
  controllers: [RbacController],
  providers: [RbacRepository, RbacService],
  exports: [RbacService],
})
export class RbacModule {}
