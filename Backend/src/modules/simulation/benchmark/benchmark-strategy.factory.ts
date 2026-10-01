import { MinEstimatedWaitingTimeStrategy } from '../../routing/strategies/min-estimated-waiting-time.strategy';
import { ShortestQueueStrategy } from '../../routing/strategies/shortest-queue.strategy';
import { RoundRobinStrategy } from '../../routing/strategies/round-robin.strategy';
import { RandomStrategy } from '../../routing/strategies/random.strategy';
import { LeastUtilisedStrategy } from '../../routing/strategies/least-utilised.strategy';
import { RoutingStrategy } from '../../routing/strategies/routing-strategy.interface';
import { BenchmarkAlgorithm } from './benchmark.types';

export function createBenchmarkStrategy(algorithm: BenchmarkAlgorithm): RoutingStrategy {
  switch (algorithm) {
    case 'SYSTEM':
      return new MinEstimatedWaitingTimeStrategy();
    case 'SHORTEST_QUEUE':
      return new ShortestQueueStrategy();
    case 'ROUND_ROBIN':
      return new RoundRobinStrategy();
    case 'RANDOM':
      return new RandomStrategy();
    case 'LEAST_UTILISED':
      return new LeastUtilisedStrategy();
  }
}

export const BENCHMARK_ALGORITHM_LABELS: Record<BenchmarkAlgorithm, string> = {
  SYSTEM: 'System Algorithm — Min Estimated Waiting Time',
  SHORTEST_QUEUE: 'Shortest Queue',
  ROUND_ROBIN: 'Round Robin',
  RANDOM: 'Random (Seeded)',
  LEAST_UTILISED: 'Least Utilised',
};
