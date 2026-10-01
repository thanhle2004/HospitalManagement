import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoutingEngineService } from './routing-engine.service';
import { Permissions } from '../rbac/decorators/permissions.decorator';

@ApiTags('Routing Engine')
@ApiBearerAuth()
@Controller('routing')
export class RoutingController {
  constructor(private readonly routingEngineService: RoutingEngineService) {}

  @Permissions('routing.process')
  @Post('process-now')
  @ApiOperation({
    summary:
      '[Admin] Chạy Routing Engine ngay lập tức (thay vì chờ cron 10s) — hữu ích khi test/debug',
  })
  processNow() {
    return this.routingEngineService.processPendingQueue();
  }
}
