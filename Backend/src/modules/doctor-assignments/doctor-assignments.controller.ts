import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DoctorAssignmentsService } from './doctor-assignments.service';
import { CreateDoctorAssignmentDto } from './dto/create-doctor-assignment.dto';
import { FindDoctorAssignmentsQueryDto } from './dto/find-doctor-assignments-query.dto';
import { DoctorAssignmentResponseDto } from './dto/doctor-assignment-response.dto';
import { Permissions } from '../rbac/decorators/permissions.decorator';

@ApiTags('Doctor Assignments')
@ApiBearerAuth()
@Controller('doctor-assignments')
export class DoctorAssignmentsController {
  constructor(
    private readonly doctorAssignmentsService: DoctorAssignmentsService,
  ) {}

  @Permissions('doctor-assignments.manage')
  @Post()
  @ApiOperation({
    summary: '[Admin] Phân công Doctor vào phòng khám theo ca/khoảng thời gian',
  })
  @ApiOkResponse({ type: DoctorAssignmentResponseDto })
  create(@Body() dto: CreateDoctorAssignmentDto) {
    return this.doctorAssignmentsService.create(dto);
  }

  @Permissions('doctor-assignments.manage')
  @Get()
  @ApiOperation({
    summary: 'Danh sách ca trực (lọc theo doctorId/roomId/activeOnly)',
  })
  @ApiOkResponse({ type: DoctorAssignmentResponseDto, isArray: true })
  findAll(@Query() query: FindDoctorAssignmentsQueryDto) {
    return this.doctorAssignmentsService.findAll(query);
  }

  @Permissions('doctor-assignments.manage')
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết 1 ca trực' })
  @ApiOkResponse({ type: DoctorAssignmentResponseDto })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.doctorAssignmentsService.findById(id);
  }

  @Permissions('doctor-assignments.manage')
  @Patch(':id/end')
  @ApiOperation({ summary: '[Admin] Kết thúc ca trực sớm (đặt endTime = hiện tại)' })
  @ApiOkResponse({ type: DoctorAssignmentResponseDto })
  endShift(@Param('id', ParseIntPipe) id: number) {
    return this.doctorAssignmentsService.endShift(id);
  }

  @Permissions('doctor-assignments.manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xoá ca trực (tạo nhầm)' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.doctorAssignmentsService.remove(id);
  }
}
