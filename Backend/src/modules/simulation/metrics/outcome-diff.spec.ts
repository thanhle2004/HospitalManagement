import { diffSimulationOutcomes, SimulationOutcomeSummary } from './outcome-diff';

function outcome(overrides: Partial<SimulationOutcomeSummary> = {}): SimulationOutcomeSummary {
  return {
    visitsCompleted: 10,
    noShows: 0,
    violationCountsByRule: {},
    perRoom: {},
    ...overrides,
  };
}

describe('diffSimulationOutcomes', () => {
  it('reports identical:true and no differences for 2 exactly equal outcomes', () => {
    const a = outcome({ perRoom: { 4: { patientsServed: 5 } } });
    const b = outcome({ perRoom: { 4: { patientsServed: 5 } } });

    const diff = diffSimulationOutcomes(a, b);

    expect(diff.identical).toBe(true);
    expect(diff.differences).toEqual([]);
  });

  it('flags a difference in visitsCompleted — the clearest sign of a lost/duplicated visit', () => {
    const lockstep = outcome({ visitsCompleted: 20 });
    const concurrent = outcome({ visitsCompleted: 18 }); // 2 bệnh nhân "biến mất" do race

    const diff = diffSimulationOutcomes(lockstep, concurrent);

    expect(diff.identical).toBe(false);
    expect(diff.differences).toContainEqual({
      field: 'visitsCompleted',
      lockstep: 20,
      concurrent: 18,
    });
  });

  it('flags a difference in noShows', () => {
    const diff = diffSimulationOutcomes(outcome({ noShows: 1 }), outcome({ noShows: 3 }));
    expect(diff.differences).toContainEqual({ field: 'noShows', lockstep: 1, concurrent: 3 });
  });

  describe('violation counts', () => {
    it('flags a rule whose violation count differs between the 2 runs', () => {
      const lockstep = outcome({ violationCountsByRule: { A7_ROOM_RUNTIME_STALE: 0 } });
      const concurrent = outcome({ violationCountsByRule: { A7_ROOM_RUNTIME_STALE: 4 } });

      const diff = diffSimulationOutcomes(lockstep, concurrent);

      expect(diff.differences).toContainEqual({
        field: 'violation:A7_ROOM_RUNTIME_STALE',
        lockstep: 0,
        concurrent: 4,
      });
    });

    it('treats a rule missing entirely from one side as count 0, not as "cannot compare"', () => {
      const lockstep = outcome({ violationCountsByRule: {} });
      const concurrent = outcome({ violationCountsByRule: { A1_NOT_IN_SERVICE_IN_TWO_ROOMS: 2 } });

      const diff = diffSimulationOutcomes(lockstep, concurrent);

      expect(diff.differences).toContainEqual({
        field: 'violation:A1_NOT_IN_SERVICE_IN_TWO_ROOMS',
        lockstep: 0,
        concurrent: 2,
      });
    });

    it('does not flag a rule that is equally absent (both 0) from both sides', () => {
      const diff = diffSimulationOutcomes(outcome(), outcome());
      expect(diff.differences.some((d) => d.field.startsWith('violation:'))).toBe(false);
    });
  });

  describe('per-room patientsServed', () => {
    it('flags a room whose patientsServed differs — evidence of a routing imbalance under concurrency (§2.1)', () => {
      const lockstep = outcome({
        perRoom: { 10: { patientsServed: 5 }, 20: { patientsServed: 5 } },
      });
      const concurrent = outcome({
        perRoom: { 10: { patientsServed: 9 }, 20: { patientsServed: 1 } },
      });

      const diff = diffSimulationOutcomes(lockstep, concurrent);

      expect(diff.differences).toContainEqual({ field: 'room:10:patientsServed', lockstep: 5, concurrent: 9 });
      expect(diff.differences).toContainEqual({ field: 'room:20:patientsServed', lockstep: 5, concurrent: 1 });
    });

    it('treats a room present only on one side as 0 on the other, not as incomparable', () => {
      const lockstep = outcome({ perRoom: { 10: { patientsServed: 3 } } });
      const concurrent = outcome({ perRoom: {} });

      const diff = diffSimulationOutcomes(lockstep, concurrent);

      expect(diff.differences).toContainEqual({ field: 'room:10:patientsServed', lockstep: 3, concurrent: 0 });
    });
  });

  it('reports multiple simultaneous differences, not just the first one found', () => {
    const lockstep = outcome({
      visitsCompleted: 20,
      noShows: 0,
      violationCountsByRule: {},
      perRoom: { 10: { patientsServed: 10 } },
    });
    const concurrent = outcome({
      visitsCompleted: 19,
      noShows: 1,
      violationCountsByRule: { A11_PATIENT_STUCK: 1 },
      perRoom: { 10: { patientsServed: 9 } },
    });

    const diff = diffSimulationOutcomes(lockstep, concurrent);

    expect(diff.identical).toBe(false);
    expect(diff.differences).toHaveLength(4);
  });
});