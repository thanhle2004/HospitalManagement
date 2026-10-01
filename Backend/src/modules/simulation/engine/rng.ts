/**
 * Bộ sinh số ngẫu nhiên tất định cho Simulator (xem
 * docs/simulator-architecture.md §3.4 — "Determinism guarantees").
 *
 * Ý tưởng cốt lõi: KHÔNG dùng 1 PRNG duy nhất dùng chung cho mọi thứ (arrival
 * time, chọn Flow, service time, no-show...) — vì khi đó thêm/bớt 1 lệnh gọi
 * random ở bất kỳ đâu sẽ làm lệch toàn bộ chuỗi số phía sau, khiến 2 scenario
 * chỉ khác nhau 1 chi tiết nhỏ lại cho ra kết quả không thể so sánh được.
 *
 * Thay vào đó: mỗi "concern" (vd 'arrivals', 'service-time:12', 'no-show')
 * có 1 PRNG con độc lập, được sinh bằng cách băm `seed + tên concern`. Thêm
 * 1 concern mới ở phiên bản sau KHÔNG làm lệch các concern đã tồn tại.
 */

/** xmur3 (bryc, public domain) — băm 1 chuỗi bất kỳ thành hàm sinh seed 32-bit. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 (bryc, public domain) — PRNG 32-bit nhanh, đủ chất lượng cho mô phỏng (không dùng cho mật mã). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRng {
  private readonly streamGenerators = new Map<string, () => number>();

  constructor(private readonly seed: number) {}

  private generatorFor(stream: string): () => number {
    let gen = this.streamGenerators.get(stream);
    if (!gen) {
      const streamSeed = xmur3(`${this.seed}::${stream}`)();
      gen = mulberry32(streamSeed);
      this.streamGenerators.set(stream, gen);
    }
    return gen;
  }

  /** Số thực trong [0, 1) — lấy số tiếp theo của 1 stream. */
  float(stream: string): number {
    return this.generatorFor(stream)();
  }

  /** Số nguyên trong [min, max) — max KHÔNG bao gồm. */
  int(stream: string, min: number, max: number): number {
    if (max <= min) {
      throw new Error(`SeededRng.int('${stream}'): max (${max}) phải > min (${min})`);
    }
    return Math.floor(this.float(stream) * (max - min)) + min;
  }

  /** true với xác suất `probability` (0..1) — dùng cho vd patients.noShowProbability. */
  chance(stream: string, probability: number): boolean {
    return this.float(stream) < probability;
  }

  /** Chọn 1 phần tử với xác suất đều nhau. */
  pick<T>(stream: string, items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error(`SeededRng.pick('${stream}'): danh sách rỗng`);
    }
    return items[this.int(stream, 0, items.length)];
  }

  /** Chọn 1 phần tử theo trọng số — dùng cho ScenarioConfig.patients.flowIds. */
  weightedPick<T>(stream: string, items: readonly { value: T; weight: number }[]): T {
    if (items.length === 0) {
      throw new Error(`SeededRng.weightedPick('${stream}'): danh sách rỗng`);
    }
    const total = items.reduce((sum, i) => sum + i.weight, 0);
    if (total <= 0) {
      throw new Error(`SeededRng.weightedPick('${stream}'): tổng trọng số phải > 0`);
    }
    let roll = this.float(stream) * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item.value;
    }
    return items[items.length - 1].value; // phòng sai số dấu phẩy động ở biên
  }

  /** Khoảng thời gian (cùng đơn vị với ratePerUnit) tới sự kiện tiếp theo của
   * 1 tiến trình Poisson — dùng cho arrival.kind = 'POISSON'. */
  exponential(stream: string, ratePerUnit: number): number {
    if (ratePerUnit <= 0) {
      throw new Error(`SeededRng.exponential('${stream}'): ratePerUnit phải > 0`);
    }
    const u = this.float(stream);
    // dùng (1 - u) thay vì u để không bao giờ lấy log(0) dù u ra đúng 0
    return -Math.log(1 - u) / ratePerUnit;
  }

  /** Số thực trong [min, max) đều nhau — dùng cho arrival.kind = 'UNIFORM'. */
  uniform(stream: string, min: number, max: number): number {
    return min + this.float(stream) * (max - min);
  }

  /** Phân phối chuẩn (Box-Muller) — dùng cho serviceTime.distribution =
   * 'NORMAL'. Kẹp về 0 vì thời lượng không thể âm. */
  normal(stream: string, mean: number, stdDev: number): number {
    const u1 = Math.max(this.float(`${stream}::u1`), Number.EPSILON);
    const u2 = this.float(`${stream}::u2`);
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, mean + z * stdDev);
  }
}