import { generateBenchmarkScenario } from './benchmark-scenario.generator';
import { runBenchmarkScenario } from './benchmark-runner';
import {
  DEFAULT_SEEDS,
  aggregateResults,
  defaultExperimentDefinition,
  pairedComparisons,
  rawResultsCsv,
  runExperiment,
  summarize,
} from './benchmark-experiment';

describe('multi-seed benchmark experiment infrastructure', () => {
  it('uses an explicit deterministic 30-seed sequence', () => {
    expect(DEFAULT_SEEDS).toEqual(Array.from({ length: 30 }, (_, index) => 20_261_001 + index));
  });

  it('generates every profile/workflow/algorithm combination with paired seeds', () => {
    const definition = { ...defaultExperimentDefinition(), patientCount: 2, seeds: [20261001, 20261002] };
    const raw = runExperiment(definition);
    expect(raw).toHaveLength(2 * 2 * 3 * 5);
    for (const profile of definition.profiles) for (const workflow of definition.workflows) for (const seed of definition.seeds) {
      const rows = raw.filter((row) => row.profile === profile && row.workflow === workflow && row.seed === seed);
      expect(rows.map((row) => row.algorithm)).toEqual(definition.algorithms);
      expect(new Set(rows.map((row) => row.scenarioId)).size).toBe(1);
    }
  });

  it('calculates sample statistics and a Student-t confidence interval', () => {
    const summary = summarize([1, 2, 3]);
    expect(summary.mean).toBe(2);
    expect(summary.standardDeviation).toBe(1);
    expect(summary.median).toBe(2);
    expect(summary.minimum).toBe(1);
    expect(summary.maximum).toBe(3);
    expect(summary.ci95Low).toBeCloseTo(2 - 4.302653 / Math.sqrt(3));
    expect(summary.ci95High).toBeCloseTo(2 + 4.302653 / Math.sqrt(3));
  });

  it('aligns paired differences by seed rather than row position', () => {
    const definition = { ...defaultExperimentDefinition(), patientCount: 2, seeds: [20261001, 20261002] };
    const raw = runExperiment(definition);
    raw.reverse();
    const paired = pairedComparisons(raw).find((row) => row.profile === 'HETEROGENEOUS' && row.workflow === 'INDEPENDENT' && row.baselineAlgorithm === 'SHORTEST_QUEUE' && row.metric === 'avgStepWaitSeconds');
    const expected = definition.seeds.map((seed) => {
      const system = raw.find((row) => row.seed === seed && row.profile === 'HETEROGENEOUS' && row.workflow === 'INDEPENDENT' && row.algorithm === 'SYSTEM')!;
      const baseline = raw.find((row) => row.seed === seed && row.profile === 'HETEROGENEOUS' && row.workflow === 'INDEPENDENT' && row.algorithm === 'SHORTEST_QUEUE')!;
      return baseline.avgStepWaitSeconds - system.avgStepWaitSeconds;
    });
    expect(paired!.meanAbsoluteDifference).toBeCloseTo(expected.reduce((sum, value) => sum + value, 0) / expected.length);
  });

  it('aggregates fixture groups and emits required raw CSV fields', () => {
    const raw = runExperiment({ ...defaultExperimentDefinition(), patientCount: 2, seeds: [20261001, 20261002] });
    const aggregated = aggregateResults(raw);
    expect(aggregated).toHaveLength(2 * 3 * 5);
    expect(aggregated[0].avgStepWaitSeconds.n).toBe(2);
    const sourceValues = raw.filter((row) => row.profile === aggregated[0].profile && row.workflow === aggregated[0].workflow && row.algorithm === aggregated[0].algorithm).map((row) => row.avgStepWaitSeconds);
    expect(aggregated[0].avgStepWaitSeconds.mean).toBeCloseTo(sourceValues.reduce((sum, value) => sum + value, 0) / sourceValues.length);
    const output = rawResultsCsv(raw);
    for (const field of ['seed', 'patientCount', 'profile', 'workflow', 'algorithm', 'avgStepWaitSeconds', 'p95StepWaitSeconds', 'avgLosSeconds', 'throughputPerHour', 'roomUtilisationPercent', 'completedPatients']) {
      expect(output.split('\n')[0]).toContain(field);
    }
  });

  it('fails loudly instead of retaining an incomplete run', () => {
    const scenario = generateBenchmarkScenario({ patientCount: 2, seed: 20261001, workflow: 'SEQUENTIAL', processingProfile: 'HOMOGENEOUS' });
    const incomplete = runBenchmarkScenario(scenario, 'SYSTEM');
    incomplete.metrics.completedPatientCount = 1;
    expect(() => runExperiment(
      { ...defaultExperimentDefinition(), patientCount: 2, seeds: [20261001, 20261002], profiles: ['HOMOGENEOUS'], workflows: ['SEQUENTIAL'] },
      () => incomplete,
    )).toThrow('completed 1/2 patients');
  });

  it('rejects a missing algorithm instead of silently producing an incomplete design', () => {
    expect(() => runExperiment({
      ...defaultExperimentDefinition(),
      seeds: [20261001, 20261002],
      algorithms: ['SYSTEM', 'SHORTEST_QUEUE'],
    })).toThrow('missing algorithms');
  });
});
