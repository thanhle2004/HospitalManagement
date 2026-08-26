import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RoutingEngineService } from './routing-engine.service';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Routing Engine')
@ApiBearerAuth()
@Controller('routing')
export class RoutingController {
  constructor(private readonly routingEngineService: RoutingEngineService) {}

  @Roles(UserRole.ADMIN)
  @Post('process-now')
  @ApiOperation({
    summary:
      '[Admin] Chạy Routing Engine ngay lập tức (thay vì chờ cron 10s) — hữu ích khi test/debug',
  })
  processNow() {
    return this.routingEngineService.processPendingQueue();
  }
}
