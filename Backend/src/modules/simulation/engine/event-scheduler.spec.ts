import { EventScheduler } from './event-scheduler';

describe('EventScheduler', () => {
  it('starts empty', () => {
    const s = new EventScheduler();
    expect(s.isEmpty()).toBe(true);
    expect(s.size).toBe(0);
    expect(s.peek()).toBeUndefined();
    expect(s.popNext()).toBeUndefined();
  });

  it('pops events in ascending simTimeMs order regardless of insertion order', () => {
    const s = new EventScheduler();
    s.schedule({ simTimeMs: 300, type: 'C' });
    s.schedule({ simTimeMs: 100, type: 'A' });
    s.schedule({ simTimeMs: 200, type: 'B' });

    expect(s.popNext()?.type).toBe('A');
    expect(s.popNext()?.type).toBe('B');
    expect(s.popNext()?.type).toBe('C');
    expect(s.popNext()).toBeUndefined();
  });

  it('breaks ties at the same simTimeMs by insertion order (seq) — this is what makes LOCKSTEP replay exact', () => {
    const s = new EventScheduler();
    s.schedule({ simTimeMs: 100, type: 'first' });
    s.schedule({ simTimeMs: 100, type: 'second' });
    s.schedule({ simTimeMs: 100, type: 'third' });

    expect(s.popNext()?.type).toBe('first');
    expect(s.popNext()?.type).toBe('second');
    expect(s.popNext()?.type).toBe('third');
  });

  it('assigns a strictly increasing seq to every scheduled event', () => {
    const s = new EventScheduler();
    const a = s.schedule({ simTimeMs: 5, type: 'A' });
    const b = s.schedule({ simTimeMs: 1, type: 'B' });
    const c = s.schedule({ simTimeMs: 5, type: 'C' });

    expect(a.seq).toBe(0);
    expect(b.seq).toBe(1);
    expect(c.seq).toBe(2);
  });

  it('peek does not remove the event', () => {
    const s = new EventScheduler();
    s.schedule({ simTimeMs: 10, type: 'A' });

    expect(s.peek()?.type).toBe('A');
    expect(s.size).toBe(1);
    expect(s.peek()?.type).toBe('A');
    expect(s.size).toBe(1);
  });

  it('rejects a negative simTimeMs', () => {
    const s = new EventScheduler();
    expect(() => s.schedule({ simTimeMs: -1, type: 'A' })).toThrow();
  });

  it('stress test: correctly orders a large random batch (validates the heap invariant, not just small hand-picked cases)', () => {
    const s = new EventScheduler();
    const n = 2000;
    // PRNG nội bộ cố định (không phụ thuộc SeededRng — test này chỉ quan tâm
    // tính đúng của heap, không quan tâm tính tất định của phân phối)
    let x = 88172645463325252n;
    const nextInt = (max: number) => {
      x ^= x << 13n;
      x ^= x >> 7n;
      x ^= x << 17n;
      x &= (1n << 63n) - 1n;
      return Number(x % BigInt(max));
    };

    const inserted: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = nextInt(10_000);
      inserted.push(t);
      s.schedule({ simTimeMs: t, type: 'X' });
    }

    const popped: number[] = [];
    while (!s.isEmpty()) {
      popped.push(s.popNext()!.simTimeMs);
    }

    expect(popped).toEqual([...inserted].sort((a, b) => a - b));
  });

  describe('cancelWhere', () => {
    it('removes only the events matching the predicate and preserves heap ordering for the rest', () => {
      const s = new EventScheduler();
      s.schedule({ simTimeMs: 10, type: 'A', visitId: 'v1' });
      s.schedule({ simTimeMs: 20, type: 'A', visitId: 'v2' });
      s.schedule({ simTimeMs: 5, type: 'A', visitId: 'v1' });
      s.schedule({ simTimeMs: 30, type: 'A', visitId: 'v3' });

      const removed = s.cancelWhere((e) => e.visitId === 'v1');

      expect(removed).toBe(2);
      expect(s.size).toBe(2);
      expect(s.popNext()?.visitId).toBe('v2');
      expect(s.popNext()?.visitId).toBe('v3');
    });

    it('returns 0 and leaves the queue untouched when nothing matches', () => {
      const s = new EventScheduler();
      s.schedule({ simTimeMs: 10, type: 'A' });
      s.schedule({ simTimeMs: 20, type: 'B' });

      const removed = s.cancelWhere((e) => e.type === 'C');

      expect(removed).toBe(0);
      expect(s.size).toBe(2);
    });
  });

  describe('clear', () => {
    it('empties the queue', () => {
      const s = new EventScheduler();
      s.schedule({ simTimeMs: 10, type: 'A' });
      s.schedule({ simTimeMs: 20, type: 'B' });

      s.clear();

      expect(s.isEmpty()).toBe(true);
      expect(s.popNext()).toBeUndefined();
    });
  });

  describe('toSortedArray', () => {
    it('returns every pending event in processing order without mutating the queue', () => {
      const s = new EventScheduler();
      s.schedule({ simTimeMs: 20, type: 'B' });
      s.schedule({ simTimeMs: 10, type: 'A' });

      const snapshot = s.toSortedArray();

      expect(snapshot.map((e) => e.type)).toEqual(['A', 'B']);
      expect(s.size).toBe(2); // vẫn còn nguyên trong hàng đợi
    });
  });
});