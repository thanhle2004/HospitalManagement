import { SimulationEngine } from './simulation-engine';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

type ChainEventType = 'ARRIVED' | 'STARTED' | 'COMPLETED';

interface TraceEntry {
  simTimeMs: number;
  type: ChainEventType;
  visitId?: string;
}

/** Kịch bản nhỏ, tự chứa: 10 "bệnh nhân" tới rải theo mốc cố định, mỗi
 * người trải qua ARRIVED -> (delay ngẫu nhiên từ rng) -> STARTED -> (+5ms)
 * -> COMPLETED. Không đụng gì tới domain bệnh viện thật — chỉ dùng để kiểm
 * chứng cơ chế orchestrate của engine tự nó là tất định. */
function buildChainScenario(seed: number) {
  const trace: TraceEntry[] = [];
  const engine = new SimulationEngine<ChainEventType>({
    seed,
    mode: 'LOCKSTEP',
    clock: { policy: 'ASAP' },
  });

  engine.on('ARRIVED', (event, ctx) => {
    trace.push({ simTimeMs: event.simTimeMs, type: 'ARRIVED', visitId: event.visitId });
    const delay = Math.round(ctx.rng.uniform('service-time', 10, 50));
    ctx.schedule({ simTimeMs: ctx.now + delay, type: 'STARTED', visitId: event.visitId });
  });
  engine.on('STARTED', (event, ctx) => {
    trace.push({ simTimeMs: event.simTimeMs, type: 'STARTED', visitId: event.visitId });
    ctx.schedule({ simTimeMs: ctx.now + 5, type: 'COMPLETED', visitId: event.visitId });
  });
  engine.on('COMPLETED', (event) => {
    trace.push({ simTimeMs: event.simTimeMs, type: 'COMPLETED', visitId: event.visitId });
  });

  for (let i = 0; i < 10; i++) {
    engine.schedule({ simTimeMs: i * 3, type: 'ARRIVED', visitId: `v${i}` });
  }

  return { engine, trace };
}

describe('SimulationEngine', () => {
  describe('determinism (Phase 1 gate)', () => {
    it('produces the exact same event trace for the same seed, run twice', async () => {
      const a = buildChainScenario(12345);
      const reasonA = await a.engine.run();

      const b = buildChainScenario(12345);
      const reasonB = await b.engine.run();

      expect(reasonA).toBe('COMPLETED');
      expect(reasonB).toBe('COMPLETED');
      expect(b.trace).toEqual(a.trace);
      expect(b.engine.processedEventCount).toBe(a.engine.processedEventCount);
      expect(b.trace.length).toBe(30); // 10 bệnh nhân x 3 sự kiện mỗi người
    });

    it('produces a different trace for a different seed (proves rng timing actually drives the schedule, not just insertion order)', async () => {
      const a = buildChainScenario(1);
      await a.engine.run();
      const b = buildChainScenario(2);
      await b.engine.run();

      expect(b.trace).not.toEqual(a.trace);
    });
  });

  describe('LOCKSTEP sequencing', () => {
    it('fully awaits a handler — including its own nested await — before starting the next event, even at the identical simTimeMs', async () => {
      const log: string[] = [];
      let releaseA: () => void = () => undefined;
      const aGate = new Promise<void>((resolve) => {
        releaseA = resolve;
      });

      const engine = new SimulationEngine<'A' | 'B'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'ASAP' },
      });
      engine.on('A', async () => {
        log.push('A-start');
        await aGate;
        log.push('A-end');
      });
      engine.on('B', () => {
        log.push('B');
      });
      engine.schedule({ simTimeMs: 0, type: 'A' });
      engine.schedule({ simTimeMs: 0, type: 'B' }); // seq sau A -> phải chờ A xong hẳn mới chạy

      const runPromise = engine.run();
      await flushMicrotasks();

      expect(log).toEqual(['A-start']); // B CHƯA chạy dù cùng simTimeMs

      releaseA();
      await runPromise;

      expect(log).toEqual(['A-start', 'A-end', 'B']);
    });

    it('runs multiple handlers for the same event type sequentially, in registration order', async () => {
      const log: string[] = [];
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'ASAP' },
      });
      engine.on('X', () => {
        log.push('first');
      });
      engine.on('X', () => {
        log.push('second');
      });
      engine.schedule({ simTimeMs: 0, type: 'X' });

      await engine.run();

      expect(log).toEqual(['first', 'second']);
    });

    it('an event type with no registered handler is simply skipped, not an error', async () => {
      const engine = new SimulationEngine<'UNHANDLED'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'ASAP' },
      });
      engine.schedule({ simTimeMs: 0, type: 'UNHANDLED' });

      await expect(engine.run()).resolves.toBe('COMPLETED');
    });
  });

  describe('lifecycle', () => {
    it('starts PENDING, becomes RUNNING during run(), and COMPLETED once the queue drains', async () => {
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'ASAP' },
      });
      expect(engine.status).toBe('PENDING');
      engine.schedule({ simTimeMs: 0, type: 'X' });

      const result = await engine.run();

      expect(result).toBe('COMPLETED');
      expect(engine.status).toBe('COMPLETED');
    });

    it('rejects being run twice', async () => {
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'ASAP' },
      });
      await engine.run();

      await expect(engine.run()).rejects.toThrow();
    });

    it('an empty queue completes immediately', async () => {
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'ASAP' },
      });
      expect(await engine.run()).toBe('COMPLETED');
      expect(engine.processedEventCount).toBe(0);
    });

    it('[Phase 5] mode CONCURRENT is now supported at construction time', () => {
      expect(
        () =>
          new SimulationEngine<'X'>({
            seed: 1,
            mode: 'CONCURRENT',
            clock: { policy: 'ASAP' },
          }),
      ).not.toThrow();
    });

    it('exposes the configured mode', () => {
      const lockstep = new SimulationEngine<'X'>({ seed: 1, mode: 'LOCKSTEP', clock: { policy: 'ASAP' } });
      const concurrent = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'CONCURRENT',
        clock: { policy: 'ASAP' },
      });
      expect(lockstep.mode).toBe('LOCKSTEP');
      expect(concurrent.mode).toBe('CONCURRENT');
    });
  });

  describe('stop()', () => {
    it('stops at the next event boundary and reports STOPPED, without draining the rest of the queue', async () => {
      const processed: string[] = [];
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'STEP' }, // giữ vòng lặp lại giữa chừng để có chỗ gọi stop()
      });
      engine.on('X', (event) => {
        processed.push(event.visitId as string);
      });
      for (let i = 0; i < 5; i++) {
        engine.schedule({ simTimeMs: i, type: 'X', visitId: `v${i}` });
      }

      const runPromise = engine.run();
      engine.step(); // xử lý v0
      await flushMicrotasks();
      expect(processed).toEqual(['v0']);

      engine.stop();
      const reason = await runPromise;

      expect(reason).toBe('STOPPED');
      expect(engine.status).toBe('STOPPED');
      expect(processed).toEqual(['v0']); // v1..v4 không bao giờ chạy
    });
  });

  describe('maxEvents safety valve', () => {
    it('stops a runaway self-rescheduling handler instead of hanging forever', async () => {
      const engine = new SimulationEngine<'LOOP'>(
        { seed: 1, mode: 'LOCKSTEP', clock: { policy: 'ASAP' }, maxEvents: 50 },
      );
      // Lỗi lập trình điển hình ở 1 actor tương lai: tự lên lịch lại chính
      // mình mà quên tăng thời gian -> vòng lặp vô hạn nếu không có chặn.
      engine.on('LOOP', (_event, ctx) => {
        ctx.schedule({ simTimeMs: ctx.now, type: 'LOOP' });
      });
      engine.schedule({ simTimeMs: 0, type: 'LOOP' });

      const reason = await engine.run();

      expect(reason).toBe('MAX_EVENTS_EXCEEDED');
      expect(engine.status).toBe('FAILED');
      expect(engine.processedEventCount).toBe(50);
    });
  });

  describe('error propagation', () => {
    it('a handler that throws fails the run and sets status FAILED', async () => {
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'ASAP' },
      });
      engine.on('X', () => {
        throw new Error('boom');
      });
      engine.schedule({ simTimeMs: 0, type: 'X' });

      await expect(engine.run()).rejects.toThrow('boom');
      expect(engine.status).toBe('FAILED');
    });
  });

  describe('onEveryEvent', () => {
    it('is called for every dispatched event, after its type-specific handler runs, in dispatch order', async () => {
      const engine = new SimulationEngine<'A' | 'B'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'ASAP' },
      });
      const order: string[] = [];
      engine.on('A', () => {
        order.push('handler:A');
      });
      const observed: string[] = [];
      engine.onEveryEvent((event) => {
        order.push(`observer:${event.type}`);
        observed.push(event.type);
      });
      engine.schedule({ simTimeMs: 0, type: 'A' });
      engine.schedule({ simTimeMs: 1, type: 'B' }); // không có handler đăng ký cho B

      await engine.run();

      expect(observed).toEqual(['A', 'B']); // observer thấy CẢ event không có handler nào xử lý
      expect(order).toEqual(['handler:A', 'observer:A', 'observer:B']);
    });

    it('an observer that throws does not fail the run — the error is swallowed, not propagated', async () => {
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'ASAP' },
      });
      const secondObserverCalls: string[] = [];
      engine.onEveryEvent(() => {
        throw new Error('observer bug');
      });
      engine.onEveryEvent((event) => {
        secondObserverCalls.push(event.type);
      });
      engine.schedule({ simTimeMs: 0, type: 'X' });

      const result = await engine.run();

      expect(result).toBe('COMPLETED'); // KHÔNG FAILED dù observer đầu tiên ném lỗi
      expect(secondObserverCalls).toEqual(['X']); // observer thứ 2 vẫn chạy bình thường
    });

    it('supports multiple independent observers (e.g. MetricsCollector and a DB event writer running side by side)', async () => {
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'ASAP' },
      });
      let countA = 0;
      let countB = 0;
      engine.onEveryEvent(() => {
        countA += 1;
      });
      engine.onEveryEvent(() => {
        countB += 1;
      });
      engine.schedule({ simTimeMs: 0, type: 'X' });
      engine.schedule({ simTimeMs: 1, type: 'X' });

      await engine.run();

      expect(countA).toBe(2);
      expect(countB).toBe(2);
    });
  });

  describe('pendingEventCount / processedEventCount', () => {
    it('tracks queue depth and processed count as the run progresses', async () => {
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'LOCKSTEP',
        clock: { policy: 'STEP' },
      });
      engine.on('X', () => undefined);
      engine.schedule({ simTimeMs: 0, type: 'X' });
      engine.schedule({ simTimeMs: 1, type: 'X' });

      expect(engine.pendingEventCount).toBe(2);
      expect(engine.processedEventCount).toBe(0);

      const runPromise = engine.run();
      engine.step();
      await flushMicrotasks();

      expect(engine.pendingEventCount).toBe(1);
      expect(engine.processedEventCount).toBe(1);

      engine.step();
      await runPromise;

      expect(engine.pendingEventCount).toBe(0);
      expect(engine.processedEventCount).toBe(2);
    });
  });

  describe('CONCURRENT mode', () => {
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    it('dispatches every event at the same simTimeMs with genuine overlap (not accidentally sequential)', async () => {
      let current = 0;
      let peak = 0;
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'CONCURRENT',
        clock: { policy: 'ASAP' },
      });
      engine.on('X', async () => {
        current += 1;
        peak = Math.max(peak, current);
        await sleep(5);
        current -= 1;
      });
      for (let i = 0; i < 10; i++) {
        engine.schedule({ simTimeMs: 0, type: 'X' });
      }

      await engine.run();

      expect(peak).toBeGreaterThan(1);
    });

    it('respects concurrencyLimit — never more handlers in flight than configured', async () => {
      let current = 0;
      let peak = 0;
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'CONCURRENT',
        clock: { policy: 'ASAP' },
        concurrencyLimit: 3,
      });
      engine.on('X', async () => {
        current += 1;
        peak = Math.max(peak, current);
        await sleep(5);
        current -= 1;
      });
      for (let i = 0; i < 15; i++) {
        engine.schedule({ simTimeMs: 0, type: 'X' });
      }

      await engine.run();

      expect(peak).toBeLessThanOrEqual(3);
    });

    it('processes ticks (distinct simTimeMs) in order — a later tick never starts before the earlier tick fully finishes', async () => {
      const log: string[] = [];
      const engine = new SimulationEngine<'A' | 'B'>({
        seed: 1,
        mode: 'CONCURRENT',
        clock: { policy: 'ASAP' },
      });
      engine.on('A', async () => {
        log.push('A-start');
        await sleep(10);
        log.push('A-end');
      });
      engine.on('B', () => {
        log.push('B');
      });
      engine.schedule({ simTimeMs: 0, type: 'A' });
      engine.schedule({ simTimeMs: 1, type: 'B' }); // tick RIÊNG, sau tick của A

      await engine.run();

      expect(log).toEqual(['A-start', 'A-end', 'B']);
    });

    it('a rejecting handler does not fail the run, is reported via onEventError, and does not stop siblings in the same tick', async () => {
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'CONCURRENT',
        clock: { policy: 'ASAP' },
      });
      const succeeded: number[] = [];
      const errors: Array<{ seq: number; error: unknown }> = [];
      engine.on('X', async (event) => {
        if (event.visitId === 'bad') throw new Error('boom');
        succeeded.push(event.seq);
      });
      engine.onEventError((event, error) => errors.push({ seq: event.seq, error }));

      engine.schedule({ simTimeMs: 0, type: 'X', visitId: 'ok-1' });
      engine.schedule({ simTimeMs: 0, type: 'X', visitId: 'bad' });
      engine.schedule({ simTimeMs: 0, type: 'X', visitId: 'ok-2' });

      const result = await engine.run();

      expect(result).toBe('COMPLETED');
      expect(succeeded).toHaveLength(2);
      expect(errors).toHaveLength(1);
      expect((errors[0].error as Error).message).toBe('boom');
    });

    it('does not call onEveryEvent for an event whose handler failed', async () => {
      const engine = new SimulationEngine<'X'>({
        seed: 1,
        mode: 'CONCURRENT',
        clock: { policy: 'ASAP' },
      });
      const observed: string[] = [];
      engine.on('X', (event) => {
        if (event.visitId === 'bad') throw new Error('boom');
      });
      engine.onEveryEvent((event) => observed.push(event.visitId as string));
      engine.onEventError(() => undefined); // suppress the default console.error path

      engine.schedule({ simTimeMs: 0, type: 'X', visitId: 'ok' });
      engine.schedule({ simTimeMs: 0, type: 'X', visitId: 'bad' });

      await engine.run();

      expect(observed).toEqual(['ok']);
    });

    describe('race reproduction (Phase 5 gate)', () => {
      /** Mô phỏng thu nhỏ đúng bug §2.1 (RoutingEngineService đọc activeCount
       * TRƯỚC transaction, không khoá) — N sự kiện cùng lúc ĐỌC 1 giá trị
       * dùng chung, chờ 1 "round-trip DB", rồi GHI LẠI dựa trên giá trị đã
       * đọc, không có khoá nào cả. */
      function buildUnguardedIncrementScenario(mode: 'LOCKSTEP' | 'CONCURRENT', count: number) {
        const shared = { value: 0 };
        const engine = new SimulationEngine<'CLAIM'>({
          seed: 12345,
          mode,
          clock: { policy: 'ASAP' },
        });
        engine.on('CLAIM', async () => {
          const observed = shared.value; // "đọc activeCount" — giống RoutingEngineService.assignRoom()
          await sleep(1); // "round-trip DB" thật — đủ để các CLAIM khác cũng kịp đọc trước khi ai ghi lại
          shared.value = observed + 1; // "ghi VisitAssignment mới" — không khoá, y hệt lỗi thật
        });
        for (let i = 0; i < count; i++) {
          engine.schedule({ simTimeMs: 0, type: 'CLAIM' }); // TẤT CẢ cùng simTimeMs = 1 burst thật
        }
        return { engine, shared };
      }

      it('LOCKSTEP never loses an update — final count always exactly matches the number of claims', async () => {
        const { engine, shared } = buildUnguardedIncrementScenario('LOCKSTEP', 20);
        await engine.run();
        expect(shared.value).toBe(20);
      });

      it('CONCURRENT reliably loses updates on the SAME unguarded-read-then-write scenario — this is the race, reproduced deterministically enough to build a thesis chapter on', async () => {
        const { engine, shared } = buildUnguardedIncrementScenario('CONCURRENT', 20);
        await engine.run();
        // KHÔNG có khoá nào bảo vệ shared.value -> 1 số CLAIM đọc cùng 1 giá
        // trị TRƯỚC KHI ai ghi lại, mất cập nhật -> kết quả cuối < 20. Đây
        // CHÍNH LÀ hiện tượng §2.1 mô tả cho routing thật, chỉ thu nhỏ lại.
        expect(shared.value).toBeLessThan(20);
      });

      it('the SAME scenario (same seed, same event schedule) diverges ONLY because of mode — proving the divergence is caused by concurrency, not by the seed or the schedule', async () => {
        const lockstep = buildUnguardedIncrementScenario('LOCKSTEP', 20);
        const concurrent = buildUnguardedIncrementScenario('CONCURRENT', 20);

        await lockstep.engine.run();
        await concurrent.engine.run();

        expect(lockstep.shared.value).toBe(20);
        expect(concurrent.shared.value).not.toBe(lockstep.shared.value);
      });
    });
  });
});