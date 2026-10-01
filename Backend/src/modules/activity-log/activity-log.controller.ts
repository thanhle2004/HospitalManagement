import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActivityLogService } from './activity-log.service';
import { FindActivityLogsQueryDto } from './dto/find-activity-logs-query.dto';
import { PaginatedActivityLogResponseDto } from './dto/activity-log-response.dto';
import { Permissions } from '../rbac/decorators/permissions.decorator';

@ApiTags('Activity Log')
@ApiBearerAuth()
@Permissions('audit.read')
@Controller('activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @ApiOperation({
    summary: '[Admin] Xem nhật ký hoạt động — lọc theo entity/entityId/userId',
  })
  @ApiOkResponse({ type: PaginatedActivityLogResponseDto })
  findAll(@Query() query: FindActivityLogsQueryDto) {
    return this.activityLogService.findAll(query);
  }
}
