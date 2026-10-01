import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { getClientAddress } from '../../common/http/client-address.util';
import { getRequestId, RequestWithContext } from '../../common/http/request-context';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { CreateStaffDto, UpdateStaffStatusDto } from './dto/create-staff.dto';
import { UsersService } from './users.service';

@ApiTags('Staff')
@ApiBearerAuth()
@Permissions('staff.manage')
@Controller('api/v1/staff')
export class StaffController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(
    @CurrentUser() actor: JwtPayload,
    @Body() dto: CreateStaffDto,
    @Req() request: RequestWithContext,
  ) {
    return this.usersService.createStaff(actor.sub, dto, this.context(request));
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
    @Req() request: RequestWithContext,
  ) {
    return this.usersService.updateStaffStatus(actor.sub, id, dto, this.context(request));
  }

  private context(request: RequestWithContext) {
    return {
      requestId: getRequestId(request),
      ipAddress: getClientAddress(request as Request),
      userAgent: request.headers['user-agent'],
    };
  }
}
