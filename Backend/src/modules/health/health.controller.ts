import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  @Public()
  @Get('live')
  live() {
    return { status: 'ok' as const };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.databaseReadiness();
  }

  // Compatibility endpoint. New infrastructure should use /health/ready.
  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.databaseReadiness();
  }

  private databaseReadiness() {
    return this.health.check([() => this.prismaHealth.isHealthy('database')]);
  }
}
