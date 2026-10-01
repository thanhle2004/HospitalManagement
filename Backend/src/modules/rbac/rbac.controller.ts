import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { getClientAddress } from '../../common/http/client-address.util';
import { getRequestId, RequestWithContext } from '../../common/http/request-context';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Permissions } from './decorators/permissions.decorator';
import { AssignRoleDto, CreateRoleDto, RbacPaginationDto, RevokeRoleDto, UpdateRoleDto } from './dto/rbac.dto';
import { RbacService } from './rbac.service';

@ApiTags('RBAC')
@ApiBearerAuth()
@Permissions('rbac.manage')
@Controller('api/v1')
export class RbacController {
  constructor(private readonly service: RbacService) {}

  @Get('permissions')
  listPermissions(@Query() query: RbacPaginationDto) { return this.service.listPermissions(query); }

  @Get('roles')
  listRoles(@Query() query: RbacPaginationDto) { return this.service.listRoles(query); }

  @Post('roles')
  createRole(@CurrentUser() actor: JwtPayload, @Body() dto: CreateRoleDto, @Req() request: RequestWithContext) { return this.service.createRole(actor.sub, dto, this.auditContext(request)); }

  @Patch('roles/:id')
  updateRole(@CurrentUser() actor: JwtPayload, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto, @Req() request: RequestWithContext) { return this.service.updateRole(actor.sub, id, dto, this.auditContext(request)); }

  @Get('staff/:userId/roles')
  listUserRoles(@Param('userId') userId: string) { return this.service.listUserRoles(userId); }

  @Post('staff/:userId/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  async assignRole(@CurrentUser() actor: JwtPayload, @Param('userId') userId: string, @Body() dto: AssignRoleDto, @Req() request: RequestWithContext): Promise<void> {
    await this.service.assignRole(actor.sub, userId, dto, this.auditContext(request));
  }

  @Delete('staff/:userId/roles/:roleCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeRole(@CurrentUser() actor: JwtPayload, @Param('userId') userId: string, @Param('roleCode') roleCode: string, @Body() dto: RevokeRoleDto, @Req() request: RequestWithContext): Promise<void> {
    await this.service.revokeRole(actor.sub, userId, roleCode, dto.reason, this.auditContext(request));
  }

  private auditContext(request: RequestWithContext) {
    return {
      requestId: getRequestId(request),
      ipAddress: getClientAddress(request as Request),
      userAgent: request.headers['user-agent'],
    };
  }
}
