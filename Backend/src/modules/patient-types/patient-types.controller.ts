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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PatientTypesService } from './patient-types.service';
import { CreatePatientTypeDto } from './dto/create-patient-type.dto';
import { UpdatePatientTypeDto } from './dto/update-patient-type.dto';
import { PatientTypeResponseDto } from './dto/patient-type-response.dto';
import { Permissions } from '../rbac/decorators/permissions.decorator';

@ApiTags('Patient Types')
@ApiBearerAuth()
@Controller('patient-types')
export class PatientTypesController {
  constructor(private readonly patientTypesService: PatientTypesService) {}

  @Permissions('patient-types.manage')
  @Post()
  @ApiOperation({ summary: '[Admin] Tạo loại bệnh nhân mới' })
  @ApiOkResponse({ type: PatientTypeResponseDto })
  create(@Body() dto: CreatePatientTypeDto) {
    return this.patientTypesService.create(dto);
  }

  @Get()
  @Permissions('patient-types.read')
  @ApiOperation({ summary: 'Danh sách loại bệnh nhân' })
  @ApiOkResponse({ type: PatientTypeResponseDto, isArray: true })
  findAll() {
    return this.patientTypesService.findAll();
  }

  @Get(':id')
  @Permissions('patient-types.read')
  @ApiOperation({ summary: 'Chi tiết 1 loại bệnh nhân' })
  @ApiOkResponse({ type: PatientTypeResponseDto })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.patientTypesService.findById(id);
  }

  @Permissions('patient-types.manage')
  @Patch(':id')
  @ApiOperation({ summary: '[Admin] Cập nhật loại bệnh nhân' })
  @ApiOkResponse({ type: PatientTypeResponseDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePatientTypeDto,
  ) {
    return this.patientTypesService.update(id, dto);
  }

  @Permissions('patient-types.manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xoá (soft-delete) loại bệnh nhân' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.patientTypesService.remove(id);
  }
}
