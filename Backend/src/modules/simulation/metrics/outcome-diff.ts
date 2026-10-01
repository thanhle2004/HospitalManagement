/**
 * A13 (§11, §3.1) — "so sánh kết quả cuối cùng của LOCKSTEP và CONCURRENT
 * với cùng seed": bất kỳ khác biệt nào giữa 2 kết quả, THEO ĐỊNH NGHĨA, chỉ
 * có thể do race condition gây ra, vì input (thời điểm/nội dung sự kiện)
 * hoàn toàn giống nhau ở cả 2 lần chạy — chỉ khác đúng 1 biến: có khoá thứ
 * tự thao tác DB hay không.
 *
 * Hàm THUẦN — nhận vào 2 bản tóm tắt kết quả (không quan tâm chúng tới từ
 * đâu: từ MetricsCollector.snapshot() thật, hay dữ liệu tự dựng trong test),
 * trả ra danh sách CHÍNH XÁC những gì khác nhau. Việc CHẠY 2 lần (1 LOCKSTEP
 * + 1 CONCURRENT) là trách nhiệm của SimulationOrchestrator, không phải của
 * file này.
 */

export interface RoomOutcomeSummary {
  patientsServed: number;
}

/** Tập hợp con của MetricsSnapshot + số vi phạm theo rule — đủ để phát hiện
 * phân kỳ mà không cần so khớp TỪNG event một (quá chi tiết, dễ báo động giả
 * vì thứ tự log 2 lần chạy CONCURRENT khác nhau không tự nó là vấn đề — chỉ
 * KẾT QUẢ CUỐI CÙNG khác nhau mới là vấn đề). */
export interface SimulationOutcomeSummary {
  visitsCompleted: number;
  noShows: number;
  /** rule (vd 'A1_NOT_IN_SERVICE_IN_TWO_ROOMS') -> số lần vi phạm ghi nhận được. */
  violationCountsByRule: Record<string, number>;
  perRoom: Record<number, RoomOutcomeSummary>;
}

export type OutcomeFieldDiff =
  | { field: 'visitsCompleted'; lockstep: number; concurrent: number }
  | { field: 'noShows'; lockstep: number; concurrent: number }
  | { field: `violation:${string}`; lockstep: number; concurrent: number }
  | { field: `room:${number}:patientsServed`; lockstep: number; concurrent: number };

export interface OutcomeDiff {
  /** true nếu 2 kết quả HOÀN TOÀN giống nhau — không có bằng chứng race trong lần chạy này (KHÔNG chứng minh KHÔNG CÓ race — 1 race hiếm có thể không kích hoạt ở seed/lần chạy này, xem ghi chú ở cuối file). */
  identical: boolean;
  differences: OutcomeFieldDiff[];
}

export function diffSimulationOutcomes(
  lockstep: SimulationOutcomeSummary,
  concurrent: SimulationOutcomeSummary,
): OutcomeDiff {
  const differences: OutcomeFieldDiff[] = [];

  if (lockstep.visitsCompleted !== concurrent.visitsCompleted) {
    differences.push({
      field: 'visitsCompleted',
      lockstep: lockstep.visitsCompleted,
      concurrent: concurrent.visitsCompleted,
    });
  }
  if (lockstep.noShows !== concurrent.noShows) {
    differences.push({ field: 'noShows', lockstep: lockstep.noShows, concurrent: concurrent.noShows });
  }

  const allRules = new Set([
    ...Object.keys(lockstep.violationCountsByRule),
    ...Object.keys(concurrent.violationCountsByRule),
  ]);
  for (const rule of allRules) {
    const a = lockstep.violationCountsByRule[rule] ?? 0;
    const b = concurrent.violationCountsByRule[rule] ?? 0;
    if (a !== b) {
      differences.push({ field: `violation:${rule}`, lockstep: a, concurrent: b });
    }
  }

  const allRoomIds = new Set([
    ...Object.keys(lockstep.perRoom).map(Number),
    ...Object.keys(concurrent.perRoom).map(Number),
  ]);
  for (const roomId of allRoomIds) {
    const a = lockstep.perRoom[roomId]?.patientsServed ?? 0;
    const b = concurrent.perRoom[roomId]?.patientsServed ?? 0;
    if (a !== b) {
      differences.push({ field: `room:${roomId}:patientsServed`, lockstep: a, concurrent: b });
    }
  }

  return { identical: differences.length === 0, differences };
}

/**
 * Ghi chú về giới hạn của A13 (quan trọng, nên đọc trước khi diễn giải kết
 * quả `identical: true`):
 *
 * `identical: true` nghĩa là "không phát hiện được khác biệt ở lần so sánh
 * NÀY" — KHÔNG có nghĩa là hệ thống không có race condition. 1 race hiếm
 * (vd chỉ xảy ra khi 2 request cách nhau đúng vài mili-giây) có thể không
 * kích hoạt ở 1 seed/1 lần chạy cụ thể dù CONCURRENT mode có bật song song
 * thật. Muốn tăng độ tin cậy: chạy so sánh nhiều seed khác nhau, hoặc tăng
 * patientCount/giảm concurrencyLimit để buộc nhiều request cạnh tranh cùng
 * lúc hơn (xem docs/simulator-architecture.md §12 Scenario 2 — burst 10
 * bệnh nhân cùng lúc là kịch bản được thiết kế RIÊNG để tối đa hoá khả năng
 * kích hoạt §2.1).
 */