import { resolveSimulationServiceTimeSeconds } from './simulation-service-time';

describe('resolveSimulationServiceTimeSeconds', () => {
  it('uses the RoomType seconds without converting units', () => {
    expect(resolveSimulationServiceTimeSeconds(null, 90, 60)).toBe(90);
  });

  it('prefers the physical Room override over RoomType', () => {
    expect(resolveSimulationServiceTimeSeconds(45, 90, 60)).toBe(45);
  });

  it('keeps a scenario duration available as an explicit override', () => {
    expect(resolveSimulationServiceTimeSeconds(45, 90, 120, false)).toBe(120);
  });
});
