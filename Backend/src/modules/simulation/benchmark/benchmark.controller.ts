import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { SimulationEnabledGuard } from '../simulation-enabled.guard';
import { CompareBenchmarkDto, RunBenchmarkDto } from './benchmark.dto';
import { BenchmarkService } from './benchmark.service';
import { BenchmarkCompareEnvelopeDto, BenchmarkRunEnvelopeDto } from './benchmark-response.dto';

@ApiTags('Simulation Benchmark')
@ApiBearerAuth()
@Permissions('simulation.manage')
@UseGuards(SimulationEnabledGuard)
@Controller('simulation/benchmark')
export class BenchmarkController {
  constructor(private readonly benchmarkService: BenchmarkService) {}

  @Post('run')
  @ApiOperation({ summary: 'Run one deterministic in-memory routing algorithm benchmark' })
  @ApiCreatedResponse({ type: BenchmarkRunEnvelopeDto })
  run(@Body() dto: RunBenchmarkDto) {
    return this.benchmarkService.run(dto, dto.algorithm);
  }

  @Post('compare')
  @ApiOperation({ summary: 'Compare routing strategies on one immutable deterministic scenario' })
  @ApiCreatedResponse({ type: BenchmarkCompareEnvelopeDto })
  compare(@Body() dto: CompareBenchmarkDto) {
    return this.benchmarkService.compare(dto, dto.algorithms);
  }
}
