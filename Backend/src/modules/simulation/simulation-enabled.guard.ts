import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Simulator fixtures use the production Visit/Queue services and physical
 * Room rows. Until a separate database/schema boundary exists, the complete
 * simulator API is default-off and may only be exposed in a deployment whose
 * database is dedicated to simulation.
 */
@Injectable()
export class SimulationEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (this.config.get<boolean>('simulation.enabled') === true) return true;
    throw new ServiceUnavailableException(
      'Simulator is disabled. Set SIMULATION_ENABLED=true only in a dedicated simulation environment.',
    );
  }
}
