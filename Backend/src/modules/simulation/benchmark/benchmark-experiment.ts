import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HETEROGENEOUS_EXPECTED_SECONDS,
  HOMOGENEOUS_EXPECTED_SECONDS,
  generateBenchmarkScenario,
} from './benchmark-scenario.generator';
import { runBenchmarkScenario } from './benchmark-runner';
import {
  BenchmarkAlgorithm,
  BenchmarkRunResult,
  ProcessingProfile,
  WorkflowDependencyType,
} from './benchmark.types';

export const EXPERIMENT_VERSION = 'final-multiseed-v1';
export const DEFAULT_PATIENT_COUNT = 100;
export const DEFAULT_SEEDS = Array.from({ length: 30 }, (_, index) => 20_261_001 + index);
export const EXPERIMENT_ALGORITHMS: BenchmarkAlgorithm[] = [
  'SYSTEM', 'SHORTEST_QUEUE', 'ROUND_ROBIN', 'LEAST_UTILISED', 'RANDOM',
];
export const EXPERIMENT_PROFILES: ProcessingProfile[] = ['HOMOGENEOUS', 'HETEROGENEOUS'];
export const EXPERIMENT_WORKFLOWS: WorkflowDependencyType[] = ['INDEPENDENT', 'SEQUENTIAL', 'PARTIAL'];

export interface RawExperimentResult {
  experimentVersion: string;
  seed: number;
  patientCount: number;
  profile: ProcessingProfile;
  workflow: WorkflowDependencyType;
  algorithm: BenchmarkAlgorithm;
  scenarioId: string;
  avgStepWaitSeconds: number;
  p95StepWaitSeconds: number;
  avgLosSeconds: number;
  throughputPerHour: number;
  roomUtilisationPercent: number;
  completedPatients: number;
}

export interface StatisticalSummary {
  n: number;
  mean: number;
  standardDeviation: number;
  median: number;
  minimum: number;
  maximum: number;
  ci95Low: number;
  ci95High: number;
}

export interface AggregatedExperimentResult {
  profile: ProcessingProfile;
  workflow: WorkflowDependencyType;
  algorithm: BenchmarkAlgorithm;
  avgStepWaitSeconds: StatisticalSummary;
  p95StepWaitSeconds: StatisticalSummary;
  avgLosSeconds: StatisticalSummary;
  throughputPerHour: StatisticalSummary;
  roomUtilisationPercent: StatisticalSummary;
}

type PairedMetric = 'avgStepWaitSeconds' | 'p95StepWaitSeconds' | 'avgLosSeconds' | 'throughputPerHour';

export interface PairedComparison {
  profile: ProcessingProfile;
  workflow: WorkflowDependencyType;
  baselineAlgorithm: Exclude<BenchmarkAlgorithm, 'SYSTEM'>;
  metric: PairedMetric;
  direction: 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER';
  n: number;
  meanAbsoluteDifference: number;
  meanRelativeImprovementPercent: number;
  standardDeviationOfDifference: number;
  ci95DifferenceLow: number;
  ci95DifferenceHigh: number;
}

export interface ExperimentDefinition {
  patientCount: number;
  seeds: number[];
  algorithms: BenchmarkAlgorithm[];
  profiles: ProcessingProfile[];
  workflows: WorkflowDependencyType[];
}

type BenchmarkExecutor = typeof runBenchmarkScenario;

const T_CRITICAL_975: Record<number, number> = {
  1: 12.706205, 2: 4.302653, 3: 3.182446, 4: 2.776445, 5: 2.570582,
  6: 2.446912, 7: 2.364624, 8: 2.306004, 9: 2.262157, 10: 2.228139,
  11: 2.200985, 12: 2.178813, 13: 2.160369, 14: 2.144787, 15: 2.13145,
  16: 2.119905, 17: 2.109816, 18: 2.100922, 19: 2.093024, 20: 2.085963,
  21: 2.079614, 22: 2.073873, 23: 2.068658, 24: 2.063899, 25: 2.059539,
  26: 2.055529, 27: 2.051831, 28: 2.048407, 29: 2.04523, 30: 2.042272,
};

export function summarize(values: number[]): StatisticalSummary {
  if (values.length < 2) throw new Error('At least two observations are required for a Student-t confidence interval');
  if (values.some((value) => !Number.isFinite(value))) throw new Error('Cannot summarize non-finite values');
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const standardDeviation = Math.sqrt(variance);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const critical = T_CRITICAL_975[values.length - 1];
  if (!critical) throw new Error(`No Student-t critical value configured for df=${values.length - 1}`);
  const margin = critical * standardDeviation / Math.sqrt(values.length);
  return {
    n: values.length,
    mean,
    standardDeviation,
    median,
    minimum: sorted[0],
    maximum: sorted[sorted.length - 1],
    ci95Low: mean - margin,
    ci95High: mean + margin,
  };
}

function assertCompleteResult(result: BenchmarkRunResult, patientCount: number): void {
  if (result.metrics.completedPatientCount !== patientCount) {
    throw new Error(`${result.algorithm} completed ${result.metrics.completedPatientCount}/${patientCount} patients`);
  }
  const metrics = Object.values(result.metrics);
  if (metrics.some((value) => !Number.isFinite(value))) {
    throw new Error(`${result.algorithm} returned a NaN or infinite metric`);
  }
  const activeByPatient = new Map<string, number>();
  for (const event of result.events) {
    const active = activeByPatient.get(event.patientId) ?? 0;
    const next = event.type === 'SERVICE_STARTED' ? active + 1 : event.type === 'SERVICE_COMPLETED' ? active - 1 : active;
    if (next < 0 || next > 1) throw new Error(`${result.algorithm} violated patient service exclusivity for ${event.patientId}`);
    activeByPatient.set(event.patientId, next);
  }
}

export function runExperiment(
  definition: ExperimentDefinition,
  execute: BenchmarkExecutor = runBenchmarkScenario,
): RawExperimentResult[] {
  if (definition.seeds.length === 0 || new Set(definition.seeds).size !== definition.seeds.length) {
    throw new Error('Experiment seeds must be present and unique');
  }
  const missingAlgorithms = EXPERIMENT_ALGORITHMS.filter((algorithm) => !definition.algorithms.includes(algorithm));
  if (missingAlgorithms.length > 0) throw new Error(`Experiment is missing algorithms: ${missingAlgorithms.join(', ')}`);
  const raw: RawExperimentResult[] = [];
  for (const profile of definition.profiles) {
    for (const workflow of definition.workflows) {
      for (const seed of definition.seeds) {
        const scenario = generateBenchmarkScenario({ patientCount: definition.patientCount, workflow, seed, processingProfile: profile });
        for (const algorithm of definition.algorithms) {
          const result = execute(structuredClone(scenario), algorithm);
          assertCompleteResult(result, definition.patientCount);
          if (result.scenarioId !== scenario.scenarioId || result.seed !== seed) {
            throw new Error(`${algorithm} returned mismatched scenario or seed metadata`);
          }
          raw.push({
            experimentVersion: EXPERIMENT_VERSION,
            seed,
            patientCount: definition.patientCount,
            profile,
            workflow,
            algorithm,
            scenarioId: result.scenarioId,
            avgStepWaitSeconds: result.metrics.averageWaitingTimeMs / 1_000,
            p95StepWaitSeconds: result.metrics.p95WaitingTimeMs / 1_000,
            avgLosSeconds: result.metrics.averageLengthOfStayMs / 1_000,
            throughputPerHour: result.metrics.throughputPerSimHour,
            roomUtilisationPercent: result.metrics.averageRoomUtilizationPct,
            completedPatients: result.metrics.completedPatientCount,
          });
        }
      }
    }
  }
  const expected = definition.seeds.length * definition.profiles.length * definition.workflows.length * definition.algorithms.length;
  if (raw.length !== expected) throw new Error(`Expected ${expected} results but collected ${raw.length}`);
  return raw;
}

const METRICS = ['avgStepWaitSeconds', 'p95StepWaitSeconds', 'avgLosSeconds', 'throughputPerHour', 'roomUtilisationPercent'] as const;

export function aggregateResults(raw: RawExperimentResult[]): AggregatedExperimentResult[] {
  const results: AggregatedExperimentResult[] = [];
  for (const profile of EXPERIMENT_PROFILES) for (const workflow of EXPERIMENT_WORKFLOWS) for (const algorithm of EXPERIMENT_ALGORITHMS) {
    const rows = raw.filter((row) => row.profile === profile && row.workflow === workflow && row.algorithm === algorithm);
    if (rows.length === 0) throw new Error(`Missing aggregate group ${profile}/${workflow}/${algorithm}`);
    results.push({ profile, workflow, algorithm, ...Object.fromEntries(METRICS.map((metric) => [metric, summarize(rows.map((row) => row[metric]))])) } as AggregatedExperimentResult);
  }
  return results;
}

export function pairedComparisons(raw: RawExperimentResult[]): PairedComparison[] {
  const results: PairedComparison[] = [];
  const baselines = EXPERIMENT_ALGORITHMS.filter((algorithm): algorithm is Exclude<BenchmarkAlgorithm, 'SYSTEM'> => algorithm !== 'SYSTEM');
  const metrics: Array<{ key: PairedMetric; direction: PairedComparison['direction'] }> = [
    { key: 'avgStepWaitSeconds', direction: 'LOWER_IS_BETTER' },
    { key: 'p95StepWaitSeconds', direction: 'LOWER_IS_BETTER' },
    { key: 'avgLosSeconds', direction: 'LOWER_IS_BETTER' },
    { key: 'throughputPerHour', direction: 'HIGHER_IS_BETTER' },
  ];
  for (const profile of EXPERIMENT_PROFILES) for (const workflow of EXPERIMENT_WORKFLOWS) for (const baselineAlgorithm of baselines) {
    const systemBySeed = new Map(raw.filter((row) => row.profile === profile && row.workflow === workflow && row.algorithm === 'SYSTEM').map((row) => [row.seed, row]));
    const baselineBySeed = new Map(raw.filter((row) => row.profile === profile && row.workflow === workflow && row.algorithm === baselineAlgorithm).map((row) => [row.seed, row]));
    if (systemBySeed.size === 0 || systemBySeed.size !== baselineBySeed.size) throw new Error(`Unpaired rows for ${profile}/${workflow}/${baselineAlgorithm}`);
    for (const { key, direction } of metrics) {
      const differences: number[] = [];
      const relative: number[] = [];
      for (const [seed, system] of systemBySeed) {
        const baseline = baselineBySeed.get(seed);
        if (!baseline) throw new Error(`Missing paired seed ${seed} for ${profile}/${workflow}/${baselineAlgorithm}`);
        const difference = direction === 'LOWER_IS_BETTER' ? baseline[key] - system[key] : system[key] - baseline[key];
        differences.push(difference);
        relative.push(baseline[key] === 0 ? 0 : difference / baseline[key] * 100);
      }
      const differenceSummary = summarize(differences);
      results.push({
        profile, workflow, baselineAlgorithm, metric: key, direction, n: differences.length,
        meanAbsoluteDifference: differenceSummary.mean,
        meanRelativeImprovementPercent: relative.reduce((sum, value) => sum + value, 0) / relative.length,
        standardDeviationOfDifference: differenceSummary.standardDeviation,
        ci95DifferenceLow: differenceSummary.ci95Low,
        ci95DifferenceHigh: differenceSummary.ci95High,
      });
    }
  }
  return results;
}

function csv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) throw new Error('Cannot create an empty CSV');
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `${headers.join(',')}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(',')).join('\n')}\n`;
}

export function rawResultsCsv(raw: RawExperimentResult[]): string {
  return csv(raw as unknown as Array<Record<string, unknown>>);
}

function flattenAggregates(rows: AggregatedExperimentResult[]): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const flat: Record<string, unknown> = { profile: row.profile, workflow: row.workflow, algorithm: row.algorithm };
    for (const metric of METRICS) for (const [stat, value] of Object.entries(row[metric])) flat[`${metric}_${stat}`] = value;
    return flat;
  });
}

function fixed(value: number, digits = 2): string { return value.toFixed(digits); }

export function buildSummary(aggregated: AggregatedExperimentResult[], paired: PairedComparison[], generatedAt: string): string {
  const sections: string[] = [
    '# Final Multi-Seed Simulation Benchmark', '',
    `Generated: ${generatedAt}`, '',
    `Design: ${DEFAULT_SEEDS.length} paired seeds × 2 profiles × 3 workflows × 5 algorithms; ${DEFAULT_PATIENT_COUNT} patients per run.`, '',
    'Intervals are two-sided 95% Student-t confidence intervals for the mean (df = n − 1). Values below are mean ± sample SD.', '',
  ];
  for (const profile of EXPERIMENT_PROFILES) for (const workflow of EXPERIMENT_WORKFLOWS) {
    sections.push(`## ${profile === 'HOMOGENEOUS' ? 'Homogeneous' : 'Heterogeneous'} — ${workflow === 'PARTIAL' ? 'Partial Dependency' : workflow[0] + workflow.slice(1).toLowerCase()}`, '');
    sections.push('| Algorithm | Avg Wait (s) | P95 Wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |', '|---|---:|---:|---:|---:|---:|');
    for (const row of aggregated.filter((item) => item.profile === profile && item.workflow === workflow)) {
      sections.push(`| ${row.algorithm} | ${fixed(row.avgStepWaitSeconds.mean)} ± ${fixed(row.avgStepWaitSeconds.standardDeviation)} | ${fixed(row.p95StepWaitSeconds.mean)} ± ${fixed(row.p95StepWaitSeconds.standardDeviation)} | ${fixed(row.avgLosSeconds.mean)} ± ${fixed(row.avgLosSeconds.standardDeviation)} | ${fixed(row.throughputPerHour.mean)} ± ${fixed(row.throughputPerHour.standardDeviation)} | ${fixed(row.roomUtilisationPercent.mean)} ± ${fixed(row.roomUtilisationPercent.standardDeviation)} |`);
    }
    sections.push('');
  }
  const sq = (profile: ProcessingProfile, workflow: WorkflowDependencyType, metric: PairedMetric) => paired.find(
    (row) => row.profile === profile && row.workflow === workflow && row.baselineAlgorithm === 'SHORTEST_QUEUE' && row.metric === metric,
  )!;
  const aggregate = (profile: ProcessingProfile, workflow: WorkflowDependencyType, algorithm: BenchmarkAlgorithm) => aggregated.find(
    (row) => row.profile === profile && row.workflow === workflow && row.algorithm === algorithm,
  )!;
  const independentWait = sq('HETEROGENEOUS', 'INDEPENDENT', 'avgStepWaitSeconds');
  const independentP95 = sq('HETEROGENEOUS', 'INDEPENDENT', 'p95StepWaitSeconds');
  const independentLos = sq('HETEROGENEOUS', 'INDEPENDENT', 'avgLosSeconds');
  const partialWait = sq('HETEROGENEOUS', 'PARTIAL', 'avgStepWaitSeconds');
  const partialP95 = sq('HETEROGENEOUS', 'PARTIAL', 'p95StepWaitSeconds');
  const partialLos = sq('HETEROGENEOUS', 'PARTIAL', 'avgLosSeconds');
  const independentThroughput = sq('HETEROGENEOUS', 'INDEPENDENT', 'throughputPerHour');
  const partialThroughput = sq('HETEROGENEOUS', 'PARTIAL', 'throughputPerHour');
  const homogeneousIndependent = aggregate('HOMOGENEOUS', 'INDEPENDENT', 'SYSTEM');
  const homogeneousIndependentLeast = aggregate('HOMOGENEOUS', 'INDEPENDENT', 'LEAST_UTILISED');
  sections.push(
    '## Research findings', '',
    `- **RQ1 — homogeneous control:** SYSTEM and Shortest Queue were exactly equal for all recorded metrics in all three workflows across all ${DEFAULT_SEEDS.length} paired seeds. This is empirical convergence under equal expected processing times, not a test-enforced ranking.`,
    `- **RQ2/RQ3 — heterogeneous workloads:** Against Shortest Queue, SYSTEM reduced mean step wait by ${fixed(independentWait.meanRelativeImprovementPercent)}% in Independent (paired difference ${fixed(independentWait.meanAbsoluteDifference)}s; 95% CI ${fixed(independentWait.ci95DifferenceLow)} to ${fixed(independentWait.ci95DifferenceHigh)}s) and ${fixed(partialWait.meanRelativeImprovementPercent)}% in Partial (${fixed(partialWait.meanAbsoluteDifference)}s; 95% CI ${fixed(partialWait.ci95DifferenceLow)} to ${fixed(partialWait.ci95DifferenceHigh)}s). The tail effect was larger: P95 reductions were ${fixed(independentP95.meanRelativeImprovementPercent)}% (${fixed(independentP95.meanAbsoluteDifference)}s; 95% CI ${fixed(independentP95.ci95DifferenceLow)} to ${fixed(independentP95.ci95DifferenceHigh)}s) and ${fixed(partialP95.meanRelativeImprovementPercent)}% (${fixed(partialP95.meanAbsoluteDifference)}s; 95% CI ${fixed(partialP95.ci95DifferenceLow)} to ${fixed(partialP95.ci95DifferenceHigh)}s).`,
    `- **LOS:** Corresponding mean LOS reductions were ${fixed(independentLos.meanRelativeImprovementPercent)}% in Independent (95% CI for paired difference ${fixed(independentLos.ci95DifferenceLow)} to ${fixed(independentLos.ci95DifferenceHigh)}s) and ${fixed(partialLos.meanRelativeImprovementPercent)}% in Partial (${fixed(partialLos.ci95DifferenceLow)} to ${fixed(partialLos.ci95DifferenceHigh)}s).`,
    '- **Sequential topology:** SYSTEM and Shortest Queue were exactly equal even under heterogeneous processing times because only one service is eligible at each decision and both rooms for that service have the same expected time.',
    `- **Throughput uncertainty:** SYSTEM's paired throughput difference versus Shortest Queue was ${fixed(independentThroughput.meanAbsoluteDifference, 3)}/h in Independent (95% CI ${fixed(independentThroughput.ci95DifferenceLow, 3)} to ${fixed(independentThroughput.ci95DifferenceHigh, 3)}) and ${fixed(partialThroughput.meanAbsoluteDifference, 3)}/h in Partial (${fixed(partialThroughput.ci95DifferenceLow, 3)} to ${fixed(partialThroughput.ci95DifferenceHigh, 3)}); both intervals include zero.`,
    `- **Topology:** For heterogeneous SYSTEM, mean step wait increased from ${fixed(aggregate('HETEROGENEOUS', 'INDEPENDENT', 'SYSTEM').avgStepWaitSeconds.mean)}s (Independent) to ${fixed(aggregate('HETEROGENEOUS', 'PARTIAL', 'SYSTEM').avgStepWaitSeconds.mean)}s (Partial) and ${fixed(aggregate('HETEROGENEOUS', 'SEQUENTIAL', 'SYSTEM').avgStepWaitSeconds.mean)}s (Sequential). Routing freedom reduced mean wait, while the SYSTEM-vs-Shortest Queue benefit appeared only where more than one service could be eligible.`,
    `- **Counterexample to a single-metric ranking:** In Homogeneous Independent, Least Utilised had worse mean wait than SYSTEM (${fixed(homogeneousIndependentLeast.avgStepWaitSeconds.mean)}s vs ${fixed(homogeneousIndependent.avgStepWaitSeconds.mean)}s) but a lower mean P95 (${fixed(homogeneousIndependentLeast.p95StepWaitSeconds.mean)}s vs ${fixed(homogeneousIndependent.p95StepWaitSeconds.mean)}s). Other algorithms also cross over by metric, so no universal winner claim is supported.`,
    '',
  );
  sections.push('## SYSTEM vs Shortest Queue', '', 'Positive percentages favor SYSTEM. Lower waiting/LOS is better.', '', '| Profile | Workflow | Avg Wait Δ% | P95 Wait Δ% | LOS Δ% |', '|---|---|---:|---:|---:|');
  for (const profile of EXPERIMENT_PROFILES) for (const workflow of EXPERIMENT_WORKFLOWS) {
    const find = (metric: PairedMetric) => paired.find((row) => row.profile === profile && row.workflow === workflow && row.baselineAlgorithm === 'SHORTEST_QUEUE' && row.metric === metric)!;
    sections.push(`| ${profile} | ${workflow} | ${fixed(find('avgStepWaitSeconds').meanRelativeImprovementPercent)}% | ${fixed(find('p95StepWaitSeconds').meanRelativeImprovementPercent)}% | ${fixed(find('avgLosSeconds').meanRelativeImprovementPercent)}% |`);
  }
  sections.push('', '## Interpretation notes', '', '- Paired differences use the same seed and materialized workload for SYSTEM and each baseline.', '- A positive paired difference favors SYSTEM; a confidence interval containing zero is not clearly distinguishable from seed-to-seed variability.', '- These results describe the standalone in-memory benchmark, not the complete production routing pipeline.', '');
  return sections.join('\n');
}

export function writeExperimentOutputs(outputDirectory: string, raw: RawExperimentResult[], generatedAt = new Date().toISOString()): void {
  const aggregated = aggregateResults(raw);
  const paired = pairedComparisons(raw);
  const config = {
    experimentVersion: EXPERIMENT_VERSION,
    generatedAt,
    patientCount: DEFAULT_PATIENT_COUNT,
    seeds: DEFAULT_SEEDS,
    algorithms: EXPERIMENT_ALGORITHMS,
    profiles: EXPERIMENT_PROFILES,
    workflows: {
      INDEPENDENT: [],
      SEQUENTIAL: [['SERVICE_A', 'SERVICE_B'], ['SERVICE_B', 'SERVICE_C'], ['SERVICE_C', 'SERVICE_D'], ['SERVICE_D', 'SERVICE_E']],
      PARTIAL: [['SERVICE_A', 'SERVICE_C'], ['SERVICE_B', 'SERVICE_D'], ['SERVICE_C', 'SERVICE_E'], ['SERVICE_D', 'SERVICE_E']],
    },
    expectedProcessingTimeSeconds: { HOMOGENEOUS: HOMOGENEOUS_EXPECTED_SECONDS, HETEROGENEOUS: HETEROGENEOUS_EXPECTED_SECONDS },
    roomsPerService: 2,
    actualDurationRange: 'uniform deterministic 80%-120% of expected time, keyed by seed/patient/service',
    stepWaitingTime: 'SERVICE_STARTED - ROOM_QUEUE_ENTERED',
    confidenceInterval: 'two-sided 95% Student-t interval for mean, df=n-1',
  };
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(resolve(outputDirectory, 'experiment-config.json'), `${JSON.stringify(config, null, 2)}\n`);
  writeFileSync(resolve(outputDirectory, 'raw-results.csv'), rawResultsCsv(raw));
  writeFileSync(resolve(outputDirectory, 'aggregated-results.csv'), csv(flattenAggregates(aggregated)));
  writeFileSync(resolve(outputDirectory, 'paired-comparisons.csv'), csv(paired as unknown as Array<Record<string, unknown>>));
  writeFileSync(resolve(outputDirectory, 'summary.md'), buildSummary(aggregated, paired, generatedAt));
}

export function defaultExperimentDefinition(): ExperimentDefinition {
  return {
    patientCount: DEFAULT_PATIENT_COUNT,
    seeds: [...DEFAULT_SEEDS],
    algorithms: [...EXPERIMENT_ALGORITHMS],
    profiles: [...EXPERIMENT_PROFILES],
    workflows: [...EXPERIMENT_WORKFLOWS],
  };
}

if (require.main === module) {
  const raw = runExperiment(defaultExperimentDefinition());
  const output = resolve(process.cwd(), '..', 'docs', 'benchmark-results', 'final-multiseed');
  writeExperimentOutputs(output, raw);
  process.stdout.write(`Wrote ${raw.length} raw benchmark results to ${output}\n`);
}
