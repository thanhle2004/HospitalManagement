import { RoutingCandidate } from './routing-strategy.interface';
import { MinEstimatedWaitingTimeStrategy } from './min-estimated-waiting-time.strategy';
import { ShortestQueueStrategy } from './shortest-queue.strategy';
import { RoundRobinStrategy } from './round-robin.strategy';
import { RandomStrategy } from './random.strategy';
import { LeastUtilisedStrategy } from './least-utilised.strategy';
import { DEFAULT_ROUTING_STRATEGY_NAME, RoutingStrategyRegistry } from './routing-strategy.registry';

function candidate(
  roomId: number,
  sortOrder: number,
  activeCount: number,
  avgProcessTimeSeconds: number,
  visitStepId = 1,
  visitStepDisplayOrder = 1,
): RoutingCandidate {
  return {
    visitStepId,
    visitStepDisplayOrder,
    room: { id: roomId, roomNumber: `P${roomId}`, sortOrder },
    inServiceCount: 0,
    waitingCount: activeCount,
    effectiveAverageProcessTimeSeconds: avgProcessTimeSeconds,
    estimatedWaitingSeconds: activeCount * avgProcessTimeSeconds,
  };
}

/** Cài lại NGUYÊN VĂN thuật toán gốc trong RoutingEngineService.assignRoom()
 * trước khi tách strategy — dùng để kiểm chứng byte-for-byte equivalence
 * bằng property-based testing thay vì chỉ vài ví dụ tay. */
function originalInlineAlgorithm(candidates: RoutingCandidate[]): number {
  const sorted = [...candidates].sort(
    (a, b) =>
      a.estimatedWaitingSeconds - b.estimatedWaitingSeconds ||
      a.visitStepDisplayOrder - b.visitStepDisplayOrder ||
      a.room.sortOrder - b.room.sortOrder ||
      a.visitStepId - b.visitStepId ||
      a.room.id - b.room.id,
  );
  return sorted[0].room.id;
}

describe('MinEstimatedWaitingTimeStrategy', () => {
  const strategy = new MinEstimatedWaitingTimeStrategy();

  it('picks the room with the lowest ETA', () => {
    const candidates = [candidate(1, 1, 3, 10), candidate(2, 2, 1, 10), candidate(3, 3, 2, 10)];
    const result = strategy.select(candidates);
    expect(result.selectedRoomId).toBe(2); // ETA=10, thấp nhất
    expect(result.reason).toBe('MIN_ESTIMATED_WAITING_TIME');
  });

  it('breaks a tie by ascending sortOrder and reports a deterministic tie-break', () => {
    const candidates = [candidate(1, 5, 2, 10), candidate(2, 1, 2, 10)]; // ETA bằng nhau = 20
    const result = strategy.select(candidates);
    expect(result.selectedRoomId).toBe(2); // sortOrder 1 < 5
    expect(result.reason).toBe('DETERMINISTIC_TIE_BREAK');
  });

  it('handles a single candidate without a tie', () => {
    const result = strategy.select([candidate(1, 1, 0, 10)]);
    expect(result.selectedRoomId).toBe(1);
    expect(result.reason).toBe('MIN_ESTIMATED_WAITING_TIME');
  });

  it('keeps an idle room ETA at zero and represents the required 1 + 2 at 90 seconds example as 270 seconds', () => {
    const idle = candidate(1, 1, 0, 90);
    const loaded: RoutingCandidate = {
      ...candidate(2, 2, 0, 90),
      inServiceCount: 1,
      waitingCount: 2,
      estimatedWaitingSeconds: (1 + 2) * 90,
    };

    expect(idle.estimatedWaitingSeconds).toBe(0);
    expect(loaded.estimatedWaitingSeconds).toBe(270);
    expect(strategy.select([loaded, idle]).selectedRoomId).toBe(1);
  });

  it('uses every deterministic tie-break key in order', () => {
    const tied = [
      candidate(9, 1, 0, 90, 30, 2),
      candidate(8, 2, 0, 90, 20, 1),
      candidate(7, 1, 0, 90, 21, 1),
      candidate(6, 1, 0, 90, 20, 1),
      candidate(5, 1, 0, 90, 20, 1),
    ];

    expect(strategy.select(tied).selectedVisitStepId).toBe(20);
    expect(strategy.select(tied).selectedRoomId).toBe(5);
  });

  it('is byte-for-byte equivalent to the original inline algorithm over many random candidate sets', () => {
    let seed = 42;
    const nextRandom = () => {
      // xorshift32 nhỏ, chỉ để sinh dữ liệu test tất định — không liên quan gì tới rng của simulator
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      seed |= 0;
      return (seed >>> 0) / 4294967296;
    };

    for (let trial = 0; trial < 500; trial++) {
      const n = 1 + Math.floor(nextRandom() * 6);
      const candidates: RoutingCandidate[] = Array.from({ length: n }, (_, i) =>
        candidate(
          i + 1,
          Math.floor(nextRandom() * 4), // sortOrder trùng nhau có chủ đích, để thử case hoà cả sortOrder
          Math.floor(nextRandom() * 5),
          10,
        ),
      );

      expect(strategy.select(candidates).selectedRoomId).toBe(originalInlineAlgorithm(candidates));
    }
  });
});

describe('ShortestQueueStrategy', () => {
  const strategy = new ShortestQueueStrategy();

  it('picks the room with the fewest active assignments, ignoring avgProcessTime entirely', () => {
    // Phòng 1 có ETA thấp hơn (avgProcessTime nhỏ) nhưng activeCount cao hơn — SHORTEST_QUEUE vẫn chọn phòng 2
    const candidates = [candidate(1, 1, 3, 1), candidate(2, 2, 1, 100)];
    const result = strategy.select(candidates);
    expect(result.selectedRoomId).toBe(2);
    expect(result.reason).toBe('SHORTEST_QUEUE');
  });

  it('breaks a tie by sortOrder', () => {
    const candidates = [candidate(1, 5, 2, 10), candidate(2, 1, 2, 999)];
    const result = strategy.select(candidates);
    expect(result.selectedRoomId).toBe(2);
    expect(result.reason).toBe('TIE_BREAK_SORT_ORDER');
  });
});

describe('RoundRobinStrategy', () => {
  it('cycles through candidates in sortOrder across repeated calls', () => {
    const strategy = new RoundRobinStrategy();
    const candidates = [candidate(3, 3, 0, 10), candidate(1, 1, 0, 10), candidate(2, 2, 0, 10)];

    const picks = Array.from({ length: 5 }, () => strategy.select(candidates).selectedRoomId);

    expect(picks).toEqual([1, 2, 3, 1, 2]); // theo sortOrder 1,2,3 rồi lặp lại
  });

  it('every decision reports reason ROUND_ROBIN', () => {
    const strategy = new RoundRobinStrategy();
    const candidates = [candidate(1, 1, 0, 10)];
    expect(strategy.select(candidates).reason).toBe('ROUND_ROBIN');
  });

  it('tracks separate cycle state per distinct candidate set (e.g. a room going MAINTENANCE changes the set)', () => {
    const strategy = new RoundRobinStrategy();
    const setA = [candidate(1, 1, 0, 10), candidate(2, 2, 0, 10)];
    const setB = [candidate(10, 1, 0, 10), candidate(20, 2, 0, 10)];

    expect(strategy.select(setA).selectedRoomId).toBe(1);
    expect(strategy.select(setB).selectedRoomId).toBe(10); // set khác — vòng quay độc lập, không tiếp tục từ setA
    expect(strategy.select(setA).selectedRoomId).toBe(2); // setA tiếp tục đúng vị trí của chính nó
  });

  it('handles a single candidate by always returning it', () => {
    const strategy = new RoundRobinStrategy();
    const candidates = [candidate(1, 1, 0, 10)];
    for (let i = 0; i < 3; i++) {
      expect(strategy.select(candidates).selectedRoomId).toBe(1);
    }
  });
});

describe('RandomStrategy', () => {
  it('uses the injected deterministic random() when provided', () => {
    const strategy = new RandomStrategy();
    const candidates = [candidate(1, 1, 0, 10), candidate(2, 2, 0, 10), candidate(3, 3, 0, 10)];

    expect(strategy.select(candidates, { random: () => 0 }).selectedRoomId).toBe(1);
    expect(strategy.select(candidates, { random: () => 0.34 }).selectedRoomId).toBe(2);
    expect(strategy.select(candidates, { random: () => 0.99 }).selectedRoomId).toBe(3);
  });

  it('clamps to the last candidate when random() returns exactly 1 (edge case allowed by the RNG spec)', () => {
    const strategy = new RandomStrategy();
    const candidates = [candidate(1, 1, 0, 10), candidate(2, 2, 0, 10)];
    expect(strategy.select(candidates, { random: () => 1 }).selectedRoomId).toBe(2);
  });

  it('falls back to Math.random() and always stays within bounds when no random is injected', () => {
    const strategy = new RandomStrategy();
    const candidates = [candidate(1, 1, 0, 10), candidate(2, 2, 0, 10), candidate(3, 3, 0, 10)];
    for (let i = 0; i < 200; i++) {
      expect([1, 2, 3]).toContain(strategy.select(candidates).selectedRoomId);
    }
  });

  it('reports reason RANDOM', () => {
    const strategy = new RandomStrategy();
    expect(strategy.select([candidate(1, 1, 0, 10)], { random: () => 0 }).reason).toBe('RANDOM');
  });
});

describe('LeastUtilisedStrategy', () => {
  it('with no history yet, all rooms are equally (0%) utilised — falls back to sortOrder', () => {
    const strategy = new LeastUtilisedStrategy();
    const candidates = [candidate(2, 2, 0, 10), candidate(1, 1, 0, 10)];
    const result = strategy.select(candidates);
    expect(result.selectedRoomId).toBe(1); // hoà 0% cả hai -> sortOrder nhỏ hơn thắng
    expect(result.reason).toBe('LEAST_UTILISED');
  });

  it('prefers a room observed busy less often over many decisions', () => {
    const strategy = new LeastUtilisedStrategy();
    const candidates = [candidate(1, 1, 5, 10), candidate(2, 2, 0, 10)]; // phòng 1 LUÔN bận, phòng 2 LUÔN rảnh

    let lastResult;
    for (let i = 0; i < 10; i++) {
      lastResult = strategy.select(candidates);
    }

    expect(lastResult!.selectedRoomId).toBe(2);
  });

  it('ranks strictly by cumulative busy-ratio across the whole history — a room with any busy history can be overtaken by one with less, but never a hidden trend', () => {
    const strategy = new LeastUtilisedStrategy();
    // Phòng 1: bận ở 2/4 lần đầu (busy,busy,free,free) -> util = 0.5
    // Phòng 2: bận ở 1/4 lần đầu (free,free,free,busy) -> util = 0.25
    const rounds: Array<[boolean, boolean]> = [
      [true, false],
      [true, false],
      [false, false],
      [false, true],
    ];
    let last;
    for (const [room1Busy, room2Busy] of rounds) {
      last = strategy.select([candidate(1, 1, room1Busy ? 1 : 0, 10), candidate(2, 2, room2Busy ? 1 : 0, 10)]);
    }
    expect(last!.selectedRoomId).toBe(2); // 0.25 < 0.5

    // Giới hạn ĐÃ BIẾT (ghi trong least-utilised.strategy.ts): đây là trung
    // bình CỘNG DỒN suốt lịch sử, không phải trung bình trượt/suy giảm theo
    // thời gian — 1 khi phòng 2 đã có ít nhất 1 lần bận còn phòng 1 chưa
    // từng bận lần nào, phòng 1 sẽ LUÔN thắng (0% tuyệt đối) dù sau đó phòng
    // 2 có rảnh liên tục bao lâu đi nữa, vì tỉ lệ của phòng 2 chỉ tiệm cận
    // 0% chứ không bao giờ chạm 0% tuyệt đối nữa. Khoá lại tính chất này
    // bằng test dưới đây để không ai vô tình "sửa" nó mà không nhận ra đây
    // là hành vi đã biết trước, không phải bug mới.
    const freshStrategy = new LeastUtilisedStrategy();
    freshStrategy.select([candidate(1, 1, 1, 10), candidate(2, 2, 0, 10)]); // phòng 1 bận đúng 1 lần, phòng 2 chưa từng bận
    let stillLast;
    for (let i = 0; i < 1000; i++) {
      stillLast = freshStrategy.select([candidate(1, 1, 0, 10), candidate(2, 2, 0, 10)]); // cả 2 rảnh suốt sau đó
    }
    expect(stillLast!.selectedRoomId).toBe(2); // phòng 2 giữ mãi lợi thế 0% tuyệt đối
  });
});

describe('RoutingStrategyRegistry', () => {
  it('defaults to MIN_ESTIMATED_WAITING_TIME when no name is given', () => {
    const registry = new RoutingStrategyRegistry();
    expect(registry.get().name).toBe(DEFAULT_ROUTING_STRATEGY_NAME);
    expect(registry.get(undefined).name).toBe(DEFAULT_ROUTING_STRATEGY_NAME);
  });

  it('resolves every strategy name to the matching strategy', () => {
    const registry = new RoutingStrategyRegistry();
    expect(registry.get('SHORTEST_QUEUE').name).toBe('SHORTEST_QUEUE');
    expect(registry.get('ROUND_ROBIN').name).toBe('ROUND_ROBIN');
    expect(registry.get('RANDOM').name).toBe('RANDOM');
    expect(registry.get('LEAST_UTILISED').name).toBe('LEAST_UTILISED');
  });

  it('returns the SAME instance on repeated get() calls — required for ROUND_ROBIN/LEAST_UTILISED state to accumulate correctly', () => {
    const registry = new RoutingStrategyRegistry();
    expect(registry.get('ROUND_ROBIN')).toBe(registry.get('ROUND_ROBIN'));
  });
});
