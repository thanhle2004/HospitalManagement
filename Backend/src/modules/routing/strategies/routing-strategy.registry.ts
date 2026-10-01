import { Injectable } from '@nestjs/common';
import { RoutingStrategy, RoutingStrategyName } from './routing-strategy.interface';
import { MinEstimatedWaitingTimeStrategy } from './min-estimated-waiting-time.strategy';
import { ShortestQueueStrategy } from './shortest-queue.strategy';
import { RoundRobinStrategy } from './round-robin.strategy';
import { RandomStrategy } from './random.strategy';
import { LeastUtilisedStrategy } from './least-utilised.strategy';

export const DEFAULT_ROUTING_STRATEGY_NAME: RoutingStrategyName = 'MIN_ESTIMATED_WAITING_TIME';

/** NestJS provider mặc định singleton — QUAN TRỌNG cho ROUND_ROBIN và
 * LEAST_UTILISED: 2 strategy này tích luỹ trạng thái qua nhiều lần gọi
 * select(), nên phải là CÙNG 1 instance xuyên suốt vòng đời ứng dụng, không
 * được tạo mới mỗi lần cần dùng. */
@Injectable()
export class RoutingStrategyRegistry {
  private readonly strategies: Record<RoutingStrategyName, RoutingStrategy> = {
    MIN_ESTIMATED_WAITING_TIME: new MinEstimatedWaitingTimeStrategy(),
    SHORTEST_QUEUE: new ShortestQueueStrategy(),
    ROUND_ROBIN: new RoundRobinStrategy(),
    RANDOM: new RandomStrategy(),
    LEAST_UTILISED: new LeastUtilisedStrategy(),
  };

  /** Không truyền `name` (hoặc truyền undefined) -> chiến lược mặc định —
   * đây chính là hành vi production trước khi có khái niệm "strategy" (xem
   * docs/simulator-architecture.md §5.1). */
  get(name: RoutingStrategyName = DEFAULT_ROUTING_STRATEGY_NAME): RoutingStrategy {
    return this.strategies[name];
  }
}