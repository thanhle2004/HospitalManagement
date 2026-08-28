import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PatientJwtAuthGuard } from '../patient-auth/guards/patient-jwt-auth.guard';
import { FlowDetailResponseDto } from './dto/flow-detail-response.dto';
import { FlowResponseDto } from './dto/flow-response.dto';
import { FlowsService } from './flows.service';

@ApiTags('Patient Services')
@ApiBearerAuth()
@Public()
@UseGuards(PatientJwtAuthGuard)
@Controller('patient/flows')
export class PatientFlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  @ApiOperation({ summary: '[Patient] Danh sách dịch vụ khám đang hoạt động' })
  @ApiOkResponse({ type: FlowResponseDto, isArray: true })
  findAll() {
    return this.flowsService.findAll();
  }

  @Get(':flowId')
  @ApiOperation({ summary: '[Patient] Xem quy trình của một dịch vụ khám' })
  @ApiOkResponse({ type: FlowDetailResponseDto })
  findOne(@Param('flowId', ParseIntPipe) flowId: number) {
    return this.flowsService.findDetailById(flowId);
  }
}
