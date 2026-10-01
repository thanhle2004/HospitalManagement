import { ServiceUnavailableException } from '@nestjs/common';
import { SimulationEnabledGuard } from './simulation-enabled.guard';

describe('SimulationEnabledGuard', () => {
  it('is default-deny unless the dedicated simulation environment opts in', () => {
    const disabled = new SimulationEnabledGuard({ get: jest.fn().mockReturnValue(false) } as never);
    const enabled = new SimulationEnabledGuard({ get: jest.fn().mockReturnValue(true) } as never);

    expect(() => disabled.canActivate({} as never)).toThrow(ServiceUnavailableException);
    expect(enabled.canActivate({} as never)).toBe(true);
  });
});
