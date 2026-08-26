import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DoctorService } from './doctor.service';
import { DoctorQueueEntryDto } from './dto/doctor-queue-entry.dto';
import { ExamActionResponseDto } from './dto/exam-action-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Doctor')
@ApiBearerAuth()
@Roles(UserRole.DOCTOR) // toàn bộ controller này chỉ dành cho Doctor
@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Get('queue')
  @ApiOperation({
    summary: 'Danh sách bệnh nhân đang chờ tại (các) phòng mình được phân công',
  })
  @ApiOkResponse({ type: DoctorQueueEntryDto, isArray: true })
  getMyQueue(@CurrentUser() user: JwtPayload) {
    return this.doctorService.getMyQueue(user.sub);
  }

  @Post('visit-assignments/:id/start')
  @ApiOperation({ summary: 'Bắt đầu khám 1 bệnh nhân đã check-in' })
  @ApiOkResponse({ type: ExamActionResponseDto })
  startExam(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.doctorService.startExam(user.sub, id);
  }

  @Post('visit-assignments/:id/complete')
  @ApiOperation({ summary: 'Hoàn thành khám — tự động mở khoá bước kế tiếp' })
  @ApiOkResponse({ type: ExamActionResponseDto })
  completeExam(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.doctorService.completeExam(user.sub, id);
  }
}
