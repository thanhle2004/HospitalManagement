import { Injectable } from '@nestjs/common';
import { generateBenchmarkScenario } from './benchmark-scenario.generator';
import { runBenchmarkScenario } from './benchmark-runner';
import { BenchmarkAlgorithm, BenchmarkConfig, BenchmarkRunResult, BenchmarkStepDefinition } from './benchmark.types';

@Injectable()
export class BenchmarkService {
  run(config: BenchmarkConfig, algorithm: BenchmarkAlgorithm): BenchmarkRunResult {
    return runBenchmarkScenario(generateBenchmarkScenario(config), algorithm);
  }

  compare(config: BenchmarkConfig, algorithms: BenchmarkAlgorithm[]): {
    scenario: BenchmarkConfig & { schemaVersion: 1; scenarioId: string; services: BenchmarkStepDefinition[] };
    results: BenchmarkRunResult[];
  } {
    const scenario = generateBenchmarkScenario(config);
    return {
      scenario: {
        ...config,
        schemaVersion: scenario.schemaVersion,
        scenarioId: scenario.scenarioId,
        services: scenario.steps,
      },
      results: algorithms.map((algorithm) => runBenchmarkScenario(structuredClone(scenario), algorithm)),
    };
  }
}
