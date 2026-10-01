import { runWithConcurrencyLimit } from './concurrency-limiter';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('runWithConcurrencyLimit', () => {
  it('returns an empty array for an empty item list without calling worker', async () => {
    const worker = jest.fn();
    const results = await runWithConcurrencyLimit([], 2, worker);
    expect(results).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it('runs every item exactly once and preserves result order by original index, not completion order', async () => {
    const order = [30, 10, 20]; // item 0 chậm nhất, item 1 nhanh nhất — nhưng kết quả PHẢI theo thứ tự 0,1,2
    const results = await runWithConcurrencyLimit(order, 3, async (ms) => {
      await sleep(ms);
      return ms;
    });
    expect(results).toEqual([
      { status: 'fulfilled', value: 30 },
      { status: 'fulfilled', value: 10 },
      { status: 'fulfilled', value: 20 },
    ]);
  });

  it('never runs more than `limit` workers at the same time', async () => {
    let current = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);

    await runWithConcurrencyLimit(items, 3, async () => {
      current += 1;
      peak = Math.max(peak, current);
      await sleep(5);
      current -= 1;
    });

    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1); // xác nhận thật sự có chạy song song, không phải vô tình tuần tự hoá
  });

  it('captures a rejected worker as a rejected result instead of throwing, and keeps running the rest', async () => {
    const items = [1, 2, 3];
    const results = await runWithConcurrencyLimit(items, 2, async (i) => {
      if (i === 2) throw new Error(`boom-${i}`);
      return i * 10;
    });

    expect(results[0]).toEqual({ status: 'fulfilled', value: 10 });
    expect(results[1]).toMatchObject({ status: 'rejected' });
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    expect(results[2]).toEqual({ status: 'fulfilled', value: 30 });
  });

  it('behaves like Promise.allSettled (fully unbounded) when limit >= items.length', async () => {
    let current = 0;
    let peak = 0;
    const items = Array.from({ length: 5 }, (_, i) => i);

    await runWithConcurrencyLimit(items, 100, async () => {
      current += 1;
      peak = Math.max(peak, current);
      await sleep(5);
      current -= 1;
    });

    expect(peak).toBe(5); // không giới hạn gì — tất cả chạy cùng lúc
  });

  it('treats a non-finite limit (Infinity) as unbounded', async () => {
    let current = 0;
    let peak = 0;
    const items = Array.from({ length: 8 }, (_, i) => i);

    await runWithConcurrencyLimit(items, Infinity, async () => {
      current += 1;
      peak = Math.max(peak, current);
      await sleep(5);
      current -= 1;
    });

    expect(peak).toBe(8);
  });

  it('clamps a limit below 1 up to 1 (fully sequential), rather than breaking', async () => {
    const order: number[] = [];
    await runWithConcurrencyLimit([1, 2, 3], 0, async (i) => {
      order.push(i);
      await sleep(1);
    });
    expect(order).toEqual([1, 2, 3]);
  });

  it('passes both the item and its original index to worker', async () => {
    const seen: Array<[string, number]> = [];
    await runWithConcurrencyLimit(['a', 'b', 'c'], 1, async (item, index) => {
      seen.push([item, index]);
    });
    expect(seen).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });
});