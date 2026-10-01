import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { SimulationOrchestratorService } from './orchestrator/simulation-orchestrator.service';
import { SimulationRunsRepository } from './repositories/simulation-runs.repository';
import { SimulationViolationsRepository } from './repositories/simulation-violations.repository';
import { SimulationFixturesService } from './fixtures/simulation-fixtures.service';
import {
  CreateSimulationRunDto,
  CompareSimulationRunDto,
  UpdateSimulationSpeedDto,
} from './orchestrator/dto/create-simulation-run.dto';
import { SimulationEnabledGuard } from './simulation-enabled.guard';

/**
 * [Phase 4-6] Headless CRUD (Phase 4) + so sánh LOCKSTEP/CONCURRENT (Phase 5)
 * + điều khiển trực tiếp pause/resume/step/speed (Phase 6, chỉ có tác dụng
 * thấy được khi run tạo với clockPolicy PACED/STEP — xem
 * simulation-run-config.types.ts). CHƯA có Patient/Room Inspector (§8, §9)
 * hay export CSV/JSON — đó là Phase 7.
 */
@ApiTags('Admin Simulation')
@ApiBearerAuth()
@Permissions('simulation.manage')
@UseGuards(SimulationEnabledGuard)
@Controller('admin/simulation/runs')
export class SimulationController {
  constructor(
    private readonly orchestrator: SimulationOrchestratorService,
    private readonly simulationRunsRepository: SimulationRunsRepository,
    private readonly simulationViolationsRepository: SimulationViolationsRepository,
    private readonly simulationFixturesService: SimulationFixturesService,
  ) {}

  @Post()
  @ApiOperation({ summary: '[Admin] Tạo 1 SimulationRun mới (trạng thái PENDING, chưa chạy)' })
  async create(@Body() dto: CreateSimulationRunDto): Promise<{ id: string }> {
    const id = await this.orchestrator.createRun(dto);
    return { id };
  }

  @Post('compare')
  @ApiOperation({
    summary:
      '[Admin][Phase 5] Chạy CÙNG 1 scenario 2 lần (LOCKSTEP + CONCURRENT, cùng seed) và trả về khác biệt kết quả cuối cùng — bất kỳ khác biệt nào chỉ có thể do race condition (A13, §3.1). Đợi CẢ 2 lần chạy xong mới trả về — có thể mất vài phút với scenario lớn.',
  })
  async compare(@Body() dto: CompareSimulationRunDto) {
    return this.orchestrator.compareLockstepVsConcurrent(dto);
  }

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách SimulationRun, mới nhất trước' })
  findAll() {
    return this.simulationRunsRepository.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary:
      '[Admin] Chi tiết 1 run — nếu đang chạy trả về snapshot metrics TRỰC TIẾP từ bộ nhớ (mới hơn DB), ngược lại trả bản ghi DB cuối cùng',
  })
  async findOne(@Param('id') id: string) {
    const active = await this.orchestrator.getActiveSnapshot(id);
    if (active) return { id, ...active };

    const run = await this.simulationRunsRepository.findById(id);
    if (!run) throw new NotFoundException(`SimulationRun #${id} không tồn tại`);
    const runtime = await this.orchestrator.getRuntimeStateForRun(
      id,
      ((run.config as { rooms?: Array<{ roomId: number }> })?.rooms ?? []).map((room) => room.roomId),
    );
    return { ...run, ...runtime };
  }

  @Get(':id/violations')
  @ApiOperation({ summary: '[Admin] Toàn bộ vi phạm bất biến (A1-A12) đã ghi nhận cho 1 run' })
  async findViolations(@Param('id') id: string) {
    const violations = await this.simulationViolationsRepository.findAllByRun(id);
    // SimulationViolation.id là BigInt trong DB — convert sang string vì
    // BigInt không tự serialize JSON được (giống ActivityLog.id, xem
    // activity-logs.mapper.ts — cùng vấn đề, cùng cách giải quyết).
    return violations.map((v) => ({ ...v, id: v.id.toString() }));
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      '[Admin] Bắt đầu chạy — trả về NGAY, không đợi run xong (có thể mất tới vài phút với scenario lớn). Theo dõi tiến độ qua GET /:id.',
  })
  async start(@Param('id') id: string): Promise<{ accepted: true }> {
    await this.orchestrator.startRun(id);
    return { accepted: true };
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Dừng 1 run đang chạy ở ranh giới sự kiện an toàn tiếp theo' })
  stop(@Param('id') id: string): void {
    this.orchestrator.stopRun(id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin][Phase 6] Tạm dừng — chỉ có tác dụng thấy được với run clockPolicy PACED/STEP',
  })
  pause(@Param('id') id: string): void {
    this.orchestrator.pauseRun(id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin][Phase 6] Tiếp tục 1 run đang PAUSED' })
  resume(@Param('id') id: string): void {
    this.orchestrator.resumeRun(id);
  }

  @Post(':id/step')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin][Phase 6] Giải phóng đúng 1 sự kiện tiếp theo — chỉ có tác dụng khi clockPolicy = STEP',
  })
  step(@Param('id') id: string): void {
    this.orchestrator.stepRun(id);
  }

  @Patch(':id/speed')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin][Phase 6] Đổi tốc độ phát lại — chỉ có tác dụng với run clockPolicy PACED',
  })
  setSpeed(@Param('id') id: string, @Body() dto: UpdateSimulationSpeedDto): void {
    this.orchestrator.setRunSpeed(id, dto.speed);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      '[Admin] Xoá hẳn 1 run — dọn toàn bộ Patient/Visit/User bác sĩ/Device tổng hợp rồi xoá bản ghi SimulationRun. KHÔNG dừng run đang chạy trước — gọi /stop trước nếu run còn đang chạy.',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.simulationFixturesService.teardownAndDeleteRun(id);
  }
}
