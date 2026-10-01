import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ActivityLogService } from './activity-log.service';
import { FindActivityLogsQueryDto } from './dto/find-activity-logs-query.dto';
import { PaginatedActivityLogEnvelopeDto } from './dto/activity-log-response.dto';
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
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'entity', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'from', required: false, schema: { type: 'string', format: 'date-time' } })
  @ApiQuery({ name: 'to', required: false, schema: { type: 'string', format: 'date-time' } })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'number', example: 20, maximum: 100 } })
  @ApiOkResponse({ type: PaginatedActivityLogEnvelopeDto })
  findAll(@Query() query: FindActivityLogsQueryDto) {
    return this.activityLogService.findAll(query);
  }
}
