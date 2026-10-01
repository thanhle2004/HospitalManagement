/**
 * Chạy tối đa `limit` worker ĐỒNG THỜI trên `items`, không bao giờ tự ném
 * lỗi — mọi lỗi của từng item được gom vào kết quả dạng
 * PromiseSettledResult (giống Promise.allSettled), để 1 item lỗi không cắt
 * ngang các item khác đang chạy.
 *
 * Dùng cho CONCURRENT mode của SimulationEngine để mô phỏng đúng hình dạng
 * 1 burst thật — NHIỀU request cùng lúc — nhưng có thể GIỚI HẠN mức độ
 * song song, tránh kết quả đo được bị bóp méo bởi giới hạn hạ tầng (vd
 * Prisma connection pool cạn kiệt) thay vì phản ánh đúng hành vi bệnh viện
 * thật (xem docs/simulator-architecture.md §2.5 — "measuring Prisma pool
 * exhaustion, not hospital dynamics").
 */
export async function runWithConcurrencyLimit<TItem, TResult>(
  items: readonly TItem[],
  limit: number,
  worker: (item: TItem, index: number) => Promise<TResult>,
): Promise<PromiseSettledResult<TResult>[]> {
  if (items.length === 0) return [];

  // limit không hữu hạn hoặc >= items.length -> không có gì để giới hạn cả,
  // dùng thẳng Promise.allSettled (nhanh hơn, không qua bộ máy "slot" bên dưới).
  const effectiveLimit = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : items.length;
  if (effectiveLimit >= items.length) {
    return Promise.allSettled(items.map((item, index) => worker(item, index)));
  }

  const results: PromiseSettledResult<TResult>[] = new Array(items.length);
  let nextIndex = 0;

  async function runSlot(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        const value = await worker(items[index], index);
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const slots = Array.from({ length: effectiveLimit }, () => runSlot());
  await Promise.all(slots);
  return results;
}