import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PatientsService } from './patients.service';
import { FindAdminPatientsQueryDto } from './dto/find-admin-patients-query.dto';
import { PaginatedPatientResponseDto } from './dto/paginated-patient-response.dto';
import { PatientResponseDto } from './dto/patient-response.dto';
import { UpdatePatientTypeDto } from './dto/update-patient-type.dto';

@ApiTags('Admin Patients')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/patients')
export class AdminPatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({
    summary: '[Admin] Danh sách bệnh nhân — tìm kiếm, lọc loại và phân trang',
  })
  @ApiOkResponse({ type: PaginatedPatientResponseDto })
  findAll(@Query() query: FindAdminPatientsQueryDto) {
    return this.patientsService.findAllForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Xem chi tiết hồ sơ bệnh nhân' })
  @ApiOkResponse({ type: PatientResponseDto })
  findOne(@Param('id') id: string) {
    return this.patientsService.findById(id);
  }

  @Patch(':id/patient-type')
  @ApiOperation({ summary: '[Admin] Thay đổi phân loại bệnh nhân' })
  @ApiOkResponse({ type: PatientResponseDto })
  updatePatientType(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePatientTypeDto,
  ) {
    return this.patientsService.updatePatientType(id, dto, user.sub);
  }
}
