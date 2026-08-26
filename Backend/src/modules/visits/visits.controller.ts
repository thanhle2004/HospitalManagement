import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { AddAdHocStepDto } from './dto/add-ad-hoc-step.dto';
import { VisitResponseDto } from './dto/visit-response.dto';
import { VisitDetailResponseDto } from './dto/visit-detail-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PatientJwtAuthGuard } from '../patient-auth/guards/patient-jwt-auth.guard';
import { CurrentPatient } from '../patient-auth/decorators/current-patient.decorator';
import { PatientJwtPayload } from '../patient-auth/interfaces/patient-jwt-payload.interface';

@ApiTags('Visits')
@ApiBearerAuth()
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  // ── Patient tự phục vụ (JWT Patient riêng, không phải guard Staff global) ─

  @Public()
  @UseGuards(PatientJwtAuthGuard)
  @Post()
  @ApiOperation({
    summary: '[Patient] Đăng ký 1 dịch vụ khám (chọn Flow) — tạo Visit mới',
  })
  @ApiOkResponse({ type: VisitDetailResponseDto })
  create(
    @CurrentPatient() patient: PatientJwtPayload,
    @Body() dto: CreateVisitDto,
  ) {
    return this.visitsService.create(patient.sub, dto);
  }

  @Public()
  @UseGuards(PatientJwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: '[Patient] Danh sách Visit của chính mình' })
  @ApiOkResponse({ type: VisitResponseDto, isArray: true })
  findMine(@CurrentPatient() patient: PatientJwtPayload) {
    return this.visitsService.findAllByPatient(patient.sub);
  }

  @Public()
  @UseGuards(PatientJwtAuthGuard)
  @Get('me/:id')
  @ApiOperation({
    summary: '[Patient] Theo dõi tiến trình 1 Visit của chính mình',
  })
  @ApiOkResponse({ type: VisitDetailResponseDto })
  findMineDetail(
    @CurrentPatient() patient: PatientJwtPayload,
    @Param('id') id: string,
  ) {
    return this.visitsService.findDetailById(id, patient.sub);
  }

  // ── Staff giám sát (JwtAuthGuard Staff mặc định, không cần decorator gì thêm) ─

  @Get()
  @ApiOperation({ summary: '[Staff] Danh sách toàn bộ Visit (giám sát)' })
  @ApiOkResponse({ type: VisitResponseDto, isArray: true })
  findAll() {
    return this.visitsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '[Staff] Chi tiết 1 Visit bất kỳ' })
  @ApiOkResponse({ type: VisitDetailResponseDto })
  findOne(@Param('id') id: string) {
    return this.visitsService.findDetailById(id, null);
  }

  // ── Doctor điều chỉnh Workflow runtime (§4) ────────────────────────────

  @Roles(UserRole.DOCTOR)
  @Post(':id/steps')
  @ApiOperation({
    summary: '[Doctor] Chỉ định thêm 1 bước khám ad-hoc ngoài Workflow gốc',
  })
  @ApiOkResponse({ type: VisitDetailResponseDto })
  addAdHocStep(@Param('id') id: string, @Body() dto: AddAdHocStepDto) {
    return this.visitsService.addAdHocStep(id, dto);
  }

  @Roles(UserRole.DOCTOR)
  @Post(':id/steps/:stepId/skip')
  @ApiOperation({
    summary:
      '[Doctor] Bỏ qua 1 bước khám tuỳ chọn (chỉ khi chưa được gán phòng)',
  })
  @ApiOkResponse({ type: VisitDetailResponseDto })
  skipStep(
    @Param('id') id: string,
    @Param('stepId', ParseIntPipe) stepId: number,
  ) {
    return this.visitsService.skipStep(id, stepId);
  }
}
