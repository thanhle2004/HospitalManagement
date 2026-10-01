import { SeededRng } from './rng';

describe('SeededRng', () => {
  describe('determinism', () => {
    it('produces the exact same sequence for the same seed, twice', () => {
      const a = new SeededRng(12345);
      const b = new SeededRng(12345);

      const seqA = Array.from({ length: 20 }, () => a.float('arrivals'));
      const seqB = Array.from({ length: 20 }, () => b.float('arrivals'));

      expect(seqB).toEqual(seqA);
    });

    it('produces a different sequence for a different seed', () => {
      const a = new SeededRng(1);
      const b = new SeededRng(2);

      const seqA = Array.from({ length: 20 }, () => a.float('arrivals'));
      const seqB = Array.from({ length: 20 }, () => b.float('arrivals'));

      expect(seqB).not.toEqual(seqA);
    });

    it('gives every stream name its own independent sequence', () => {
      const rng = new SeededRng(42);

      const arrivals = Array.from({ length: 10 }, () => rng.float('arrivals'));
      const noShow = Array.from({ length: 10 }, () => rng.float('no-show'));

      expect(noShow).not.toEqual(arrivals);
    });

    it('is order-independent across concerns: interleaving two streams does not change either one', () => {
      const rng1 = new SeededRng(7);
      const onlyArrivals = Array.from({ length: 5 }, () => rng1.float('arrivals'));

      const rng2 = new SeededRng(7);
      const interleaved: number[] = [];
      for (let i = 0; i < 5; i++) {
        interleaved.push(rng2.float('arrivals'));
        rng2.float('no-show'); // "phía sau" — không được ảnh hưởng tới 'arrivals'
      }

      expect(interleaved).toEqual(onlyArrivals);
    });

    it('adding a brand-new stream never perturbs a pre-existing stream\'s sequence (the whole point of per-concern streams)', () => {
      const before = new SeededRng(99);
      const beforeSeq = Array.from({ length: 5 }, () => before.float('arrivals'));

      // Cùng seed, nhưng lần này có "chạm" vào 1 stream chưa từng tồn tại ở lần chạy trước
      const after = new SeededRng(99);
      after.float('a-brand-new-concern-added-later');
      const afterSeq = Array.from({ length: 5 }, () => after.float('arrivals'));

      expect(afterSeq).toEqual(beforeSeq);
    });
  });

  describe('int', () => {
    it('stays within [min, max) over many draws', () => {
      const rng = new SeededRng(1);
      for (let i = 0; i < 500; i++) {
        const v = rng.int('x', 3, 8);
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThan(8);
        expect(Number.isInteger(v)).toBe(true);
      }
    });

    it('throws when max <= min', () => {
      const rng = new SeededRng(1);
      expect(() => rng.int('x', 5, 5)).toThrow();
      expect(() => rng.int('x', 5, 4)).toThrow();
    });
  });

  describe('chance', () => {
    it('returns roughly `probability` share of true over many draws', () => {
      const rng = new SeededRng(1);
      let trueCount = 0;
      const n = 5000;
      for (let i = 0; i < n; i++) {
        if (rng.chance('no-show', 0.2)) trueCount++;
      }
      expect(trueCount / n).toBeGreaterThan(0.15);
      expect(trueCount / n).toBeLessThan(0.25);
    });
  });

  describe('pick', () => {
    it('only ever returns items from the list', () => {
      const rng = new SeededRng(1);
      const items = ['a', 'b', 'c'];
      for (let i = 0; i < 100; i++) {
        expect(items).toContain(rng.pick('x', items));
      }
    });

    it('throws on an empty list', () => {
      const rng = new SeededRng(1);
      expect(() => rng.pick('x', [])).toThrow();
    });
  });

  describe('weightedPick', () => {
    it('favors the heavier-weighted item over many draws', () => {
      const rng = new SeededRng(1);
      const items = [
        { value: 'rare', weight: 1 },
        { value: 'common', weight: 9 },
      ];
      let commonCount = 0;
      const n = 2000;
      for (let i = 0; i < n; i++) {
        if (rng.weightedPick('flow', items) === 'common') commonCount++;
      }
      expect(commonCount / n).toBeGreaterThan(0.8);
    });

    it('throws when total weight is 0', () => {
      const rng = new SeededRng(1);
      expect(() =>
        rng.weightedPick('x', [
          { value: 'a', weight: 0 },
          { value: 'b', weight: 0 },
        ]),
      ).toThrow();
    });
  });

  describe('exponential', () => {
    it('produces only non-negative values', () => {
      const rng = new SeededRng(1);
      for (let i = 0; i < 500; i++) {
        expect(rng.exponential('arrivals', 2)).toBeGreaterThanOrEqual(0);
      }
    });

    it('has a mean close to 1/rate over many draws', () => {
      const rng = new SeededRng(1);
      const rate = 4; // mean = 0.25
      const n = 20000;
      let sum = 0;
      for (let i = 0; i < n; i++) sum += rng.exponential('arrivals', rate);
      expect(sum / n).toBeGreaterThan(0.2);
      expect(sum / n).toBeLessThan(0.3);
    });
  });

  describe('uniform', () => {
    it('stays within [min, max)', () => {
      const rng = new SeededRng(1);
      for (let i = 0; i < 500; i++) {
        const v = rng.uniform('x', 10, 20);
        expect(v).toBeGreaterThanOrEqual(10);
        expect(v).toBeLessThan(20);
      }
    });
  });

  describe('normal', () => {
    it('never returns a negative duration', () => {
      const rng = new SeededRng(1);
      for (let i = 0; i < 500; i++) {
        expect(rng.normal('service-time:12', 5, 20)).toBeGreaterThanOrEqual(0);
      }
    });

    it('has a mean close to the configured mean over many draws', () => {
      const rng = new SeededRng(1);
      const n = 20000;
      let sum = 0;
      for (let i = 0; i < n; i++) sum += rng.normal('service-time:12', 100, 10);
      expect(sum / n).toBeGreaterThan(95);
      expect(sum / n).toBeLessThan(105);
    });
  });
});