import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { PatientResponseDto } from './dto/patient-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { PatientJwtAuthGuard } from '../patient-auth/guards/patient-jwt-auth.guard';
import { CurrentPatient } from '../patient-auth/decorators/current-patient.decorator';
import { PatientJwtPayload } from '../patient-auth/interfaces/patient-jwt-payload.interface';

@ApiTags('Patients')
@ApiBearerAuth()
@Public() // bỏ qua JwtAuthGuard (Staff, global) — PatientJwtAuthGuard bên dưới tự xác thực riêng
@UseGuards(PatientJwtAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Thông tin hồ sơ của Patient đang đăng nhập' })
  @ApiOkResponse({ type: PatientResponseDto })
  getMe(@CurrentPatient() patient: PatientJwtPayload) {
    return this.patientsService.findById(patient.sub);
  }
}
