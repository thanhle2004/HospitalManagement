import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminQueueService } from './admin-queue.service';
import { AdminQueueEntryDto } from './dto/admin-queue-entry.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Admin Queue Monitoring')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/queue')
export class AdminQueueController {
  constructor(private readonly adminQueueService: AdminQueueService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Hàng đợi thời gian thực của TOÀN VIỆN (mọi phòng)' })
  @ApiOkResponse({ type: AdminQueueEntryDto, isArray: true })
  getFullQueueOverview() {
    return this.adminQueueService.getFullQueueOverview();
  }

  @Post(':id/move-to-front')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin] Đưa 1 bệnh nhân lên đầu hàng đợi (vd trường hợp cấp cứu)',
  })
  async moveToFront(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.adminQueueService.moveToFront(user.sub, id);
  }

  @Post(':id/move-after/:targetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Chèn 1 entry vào ngay sau 1 entry khác trong cùng phòng' })
  async moveAfter(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Param('targetId', ParseIntPipe) targetId: number,
  ): Promise<void> {
    await this.adminQueueService.moveAfter(user.sub, id, targetId);
  }
}
