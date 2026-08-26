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
import { UserRole } from '@prisma/client';
import { FlowsService } from './flows.service';
import { FlowStepsService } from './flow-steps.service';
import { FlowDependenciesService } from './flow-dependencies.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { CreateFlowStepDto } from './dto/create-flow-step.dto';
import { UpdateFlowStepDto } from './dto/update-flow-step.dto';
import { CreateFlowDependencyDto } from './dto/create-flow-dependency.dto';
import { FlowResponseDto } from './dto/flow-response.dto';
import { FlowDetailResponseDto } from './dto/flow-detail-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Flows (Workflow Builder)')
@ApiBearerAuth()
@Controller('flows')
export class FlowsController {
  constructor(
    private readonly flowsService: FlowsService,
    private readonly flowStepsService: FlowStepsService,
    private readonly flowDependenciesService: FlowDependenciesService,
  ) {}

  // ── Flow ────────────────────────────────────────────────────────────

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: '[Admin] Tạo workflow (dịch vụ khám) mới' })
  @ApiOkResponse({ type: FlowResponseDto })
  create(@Body() dto: CreateFlowDto) {
    return this.flowsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách workflow' })
  @ApiOkResponse({ type: FlowResponseDto, isArray: true })
  findAll() {
    return this.flowsService.findAll();
  }

  @Get(':flowId')
  @ApiOperation({
    summary: 'Chi tiết 1 workflow — kèm toàn bộ step + dependency (đồ thị DAG)',
  })
  @ApiOkResponse({ type: FlowDetailResponseDto })
  findOne(@Param('flowId', ParseIntPipe) flowId: number) {
    return this.flowsService.findDetailById(flowId);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':flowId')
  @ApiOperation({ summary: '[Admin] Cập nhật thông tin workflow' })
  @ApiOkResponse({ type: FlowResponseDto })
  update(
    @Param('flowId', ParseIntPipe) flowId: number,
    @Body() dto: UpdateFlowDto,
  ) {
    return this.flowsService.update(flowId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':flowId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xoá (soft-delete) workflow' })
  async remove(@Param('flowId', ParseIntPipe) flowId: number): Promise<void> {
    await this.flowsService.remove(flowId);
  }

  // ── FlowStep ────────────────────────────────────────────────────────

  @Roles(UserRole.ADMIN)
  @Post(':flowId/steps')
  @ApiOperation({ summary: '[Admin] Thêm 1 bước khám (FlowStep) vào workflow' })
  createStep(
    @Param('flowId', ParseIntPipe) flowId: number,
    @Body() dto: CreateFlowStepDto,
  ) {
    return this.flowStepsService.create(flowId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':flowId/steps/:stepId')
  @ApiOperation({ summary: '[Admin] Cập nhật 1 bước khám' })
  updateStep(
    @Param('flowId', ParseIntPipe) flowId: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() dto: UpdateFlowStepDto,
  ) {
    return this.flowStepsService.update(flowId, stepId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':flowId/steps/:stepId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin] Xoá 1 bước khám (kéo theo xoá luôn dependency liên quan)',
  })
  async removeStep(
    @Param('flowId', ParseIntPipe) flowId: number,
    @Param('stepId', ParseIntPipe) stepId: number,
  ): Promise<void> {
    await this.flowStepsService.remove(flowId, stepId);
  }

  // ── FlowDependency ──────────────────────────────────────────────────

  @Roles(UserRole.ADMIN)
  @Post(':flowId/dependencies')
  @ApiOperation({
    summary:
      '[Admin] Thêm quan hệ phụ thuộc giữa 2 step — từ chối nếu tạo thành chu trình (cycle)',
  })
  createDependency(
    @Param('flowId', ParseIntPipe) flowId: number,
    @Body() dto: CreateFlowDependencyDto,
  ) {
    return this.flowDependenciesService.create(flowId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':flowId/dependencies/:stepId/:requiredStepId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Gỡ quan hệ phụ thuộc giữa 2 step' })
  async removeDependency(
    @Param('flowId', ParseIntPipe) flowId: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Param('requiredStepId', ParseIntPipe) requiredStepId: number,
  ): Promise<void> {
    await this.flowDependenciesService.remove(flowId, stepId, requiredStepId);
  }
}
