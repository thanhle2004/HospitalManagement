import { SimulationClock } from './simulation-clock';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('SimulationClock', () => {
  describe('ASAP policy', () => {
    it('commits the target time immediately without sleeping', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const clock = new SimulationClock({ policy: 'ASAP' }, sleep);

      await clock.advanceTo(5_000);

      expect(clock.now).toBe(5_000);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('advances through many events with no real delay at all', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const clock = new SimulationClock({ policy: 'ASAP' }, sleep);

      for (const t of [10, 200, 15_000, 15_001]) {
        await clock.advanceTo(t);
      }

      expect(clock.now).toBe(15_001);
      expect(sleep).not.toHaveBeenCalled();
    });
  });

  describe('PACED policy', () => {
    it('sleeps for deltaSimMs / speed', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const clock = new SimulationClock({ policy: 'PACED', speed: 2 }, sleep);

      await clock.advanceTo(1_000);

      expect(sleep).toHaveBeenCalledWith(500); // 1000ms mô phỏng / 2x tốc độ = 500ms thời gian thực
      expect(clock.now).toBe(1_000);
    });

    it('defaults to speed 1 when none is given', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const clock = new SimulationClock({ policy: 'PACED' }, sleep);

      await clock.advanceTo(300);

      expect(sleep).toHaveBeenCalledWith(300);
    });

    it('does not sleep for a zero-length step', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const clock = new SimulationClock({ policy: 'PACED', speed: 1 }, sleep);

      await clock.advanceTo(0);

      expect(sleep).not.toHaveBeenCalled();
    });

    it('setSpeed changes the delay used by the next advanceTo', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const clock = new SimulationClock({ policy: 'PACED', speed: 1 }, sleep);

      await clock.advanceTo(100); // 100ms thời gian thực ở tốc độ 1x
      clock.setSpeed(10);
      await clock.advanceTo(1_100); // +1000ms mô phỏng ở tốc độ 10x = 100ms thời gian thực

      expect(sleep).toHaveBeenNthCalledWith(1, 100);
      expect(sleep).toHaveBeenNthCalledWith(2, 100);
    });
  });

  describe('STEP policy', () => {
    it('does not resolve advanceTo until step() is called', async () => {
      const clock = new SimulationClock({ policy: 'STEP' });
      let resolved = false;

      const pending = clock.advanceTo(50).then(() => {
        resolved = true;
      });

      await flushMicrotasks();
      expect(resolved).toBe(false);
      expect(clock.now).toBe(0);

      clock.step();
      await pending;

      expect(resolved).toBe(true);
      expect(clock.now).toBe(50);
    });

    it('step() releases exactly one pending advanceTo, in FIFO order', async () => {
      const clock = new SimulationClock({ policy: 'STEP' });
      const order: number[] = [];

      const p1 = clock.advanceTo(10).then(() => order.push(1));
      const p2 = clock.advanceTo(20).then(() => order.push(2));
      await flushMicrotasks();

      clock.step();
      await p1;
      expect(order).toEqual([1]);
      expect(clock.now).toBe(10);

      clock.step();
      await p2;
      expect(order).toEqual([1, 2]);
      expect(clock.now).toBe(20);
    });

    it('an extra step() with nothing waiting is a harmless no-op', () => {
      const clock = new SimulationClock({ policy: 'STEP' });
      expect(() => clock.step()).not.toThrow();
    });
  });

  describe('pause/resume', () => {
    it('blocks advanceTo while paused, regardless of policy, and releases it on resume', async () => {
      const clock = new SimulationClock({ policy: 'ASAP' });
      clock.pause();
      expect(clock.isPaused).toBe(true);

      let resolved = false;
      const pending = clock.advanceTo(100).then(() => {
        resolved = true;
      });

      await flushMicrotasks();
      expect(resolved).toBe(false);

      clock.resume();
      await pending;

      expect(resolved).toBe(true);
      expect(clock.now).toBe(100);
      expect(clock.isPaused).toBe(false);
    });

    it('does not block advanceTo when not paused', async () => {
      const clock = new SimulationClock({ policy: 'ASAP' });
      await expect(clock.advanceTo(10)).resolves.toBeUndefined();
    });

    it('resume() before any pause is a harmless no-op', () => {
      const clock = new SimulationClock({ policy: 'ASAP' });
      expect(() => clock.resume()).not.toThrow();
      expect(clock.isPaused).toBe(false);
    });
  });

  describe('forceWake', () => {
    it('releases an advanceTo() blocked on STEP — resume() alone cannot do this', async () => {
      const clock = new SimulationClock({ policy: 'STEP' });
      let resolved = false;
      const pending = clock.advanceTo(50).then(() => {
        resolved = true;
      });

      await flushMicrotasks();
      clock.resume(); // không có tác dụng gì với STEP — chỉ để chứng minh sự khác biệt với forceWake()
      await flushMicrotasks();
      expect(resolved).toBe(false);

      clock.forceWake();
      await pending;

      expect(resolved).toBe(true);
      expect(clock.now).toBe(50);
    });

    it('releases an advanceTo() blocked on pause, and clears the paused flag', async () => {
      const clock = new SimulationClock({ policy: 'ASAP' });
      clock.pause();
      const pending = clock.advanceTo(20);
      await flushMicrotasks();

      clock.forceWake();
      await pending;

      expect(clock.now).toBe(20);
      expect(clock.isPaused).toBe(false);
    });

    it('is a harmless no-op when nothing is blocked', () => {
      const clock = new SimulationClock({ policy: 'ASAP' });
      expect(() => clock.forceWake()).not.toThrow();
    });
  });

  describe('time can never move backwards', () => {
    it('throws when the target is earlier than the current time', async () => {
      const clock = new SimulationClock({ policy: 'ASAP' });
      await clock.advanceTo(100);

      await expect(clock.advanceTo(50)).rejects.toThrow();
      expect(clock.now).toBe(100); // trạng thái không bị thay đổi bởi lời gọi lỗi
    });

    it('allows advancing to the exact same time (zero-length step)', async () => {
      const clock = new SimulationClock({ policy: 'ASAP' });
      await clock.advanceTo(100);
      await expect(clock.advanceTo(100)).resolves.toBeUndefined();
    });
  });
});