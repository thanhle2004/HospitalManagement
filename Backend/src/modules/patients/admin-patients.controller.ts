import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PatientsService } from './patients.service';
import { FindAdminPatientsQueryDto } from './dto/find-admin-patients-query.dto';
import { PaginatedPatientResponseDto } from './dto/paginated-patient-response.dto';
import { PatientResponseDto } from './dto/patient-response.dto';
import { UpdatePatientTypeDto } from './dto/update-patient-type.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuditAction } from '../activity-log/audit-action.catalog';
import { RbacService } from '../rbac/rbac.service';
import { getRequestId, RequestWithContext } from '../../common/http/request-context';
import { getClientAddress } from '../../common/http/client-address.util';

@ApiTags('Admin Patients')
@ApiBearerAuth()
@Permissions('patients.manage')
@Controller('admin/patients')
export class AdminPatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly activityLog: ActivityLogService,
    private readonly rbacService: RbacService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '[Admin] Danh sách bệnh nhân — tìm kiếm, lọc loại và phân trang',
  })
  @ApiOkResponse({ type: PaginatedPatientResponseDto })
  async findAll(@CurrentUser() actor: JwtPayload, @Query() query: FindAdminPatientsQueryDto, @Req() request: RequestWithContext) {
    const result = await this.patientsService.findAllForAdmin(query);
    await this.auditRead(actor, request, AuditAction.PATIENT_RECORDS_READ, '*', result.total, Object.keys(query));
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Xem chi tiết hồ sơ bệnh nhân' })
  @ApiOkResponse({ type: PatientResponseDto })
  async findOne(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Req() request: RequestWithContext) {
    const result = await this.patientsService.findById(id);
    await this.auditRead(actor, request, AuditAction.PATIENT_RECORD_READ, id, 1);
    return result;
  }

  @Patch(':id/patient-type')
  @ApiOperation({ summary: '[Admin] Thay đổi phân loại bệnh nhân' })
  @ApiOkResponse({ type: PatientResponseDto })
  updatePatientType(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePatientTypeDto,
    @Req() request: RequestWithContext,
  ) {
    return this.patientsService.updatePatientType(id, dto, user.sub, { requestId: getRequestId(request), ipAddress: getClientAddress(request), userAgent: request.headers['user-agent'] });
  }

  private async auditRead(actor: JwtPayload, request: RequestWithContext, action: typeof AuditAction.PATIENT_RECORD_READ | typeof AuditAction.PATIENT_RECORDS_READ, entityId: string, resultCount: number, filterFields?: string[]) {
    const access = await this.rbacService.getEffectiveAccess(actor.sub, actor.role);
    await this.activityLog.logSensitiveRead({ userId: actor.sub, action, entity: 'Patient', entityId, effectiveRoles: access.effectiveRoles, requestId: getRequestId(request), ipAddress: getClientAddress(request), userAgent: request.headers['user-agent'], resultCount, filterFields });
  }
}
