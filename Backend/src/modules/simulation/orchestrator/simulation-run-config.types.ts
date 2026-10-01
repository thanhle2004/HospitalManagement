export interface SimulationRoomConfig {
  roomId: number;
  /** Mặc định true. */
  withDoctor?: boolean;
  /** Mặc định true. */
  withDevice?: boolean;
  /** Mặc định true — lấy thời lượng hiệu lực từ Room override, nếu
   * không có thì từ RoomType.avgProcessTime. Tất cả đều là giây. */
  useRoomTypeAvgProcessTime?: boolean;
  serviceTimeMeanSeconds: number;
  /** Bỏ trống = FIXED (luôn đúng serviceTimeMeanSeconds). */
  serviceTimeStdDevSeconds?: number;
}

export type SimulationArrivalConfig =
  | { kind: 'FIXED'; intervalMs: number }
  | { kind: 'BURST'; atMs?: number };

/** [Phase 5] Mặc định LOCKSTEP — giữ nguyên hành vi Phase 4 khi không chỉ
 * định. CONCURRENT dùng để tái tạo race (xem §2.1, §12 Scenario 2). */
export type SimulationRunMode = 'LOCKSTEP' | 'CONCURRENT';

/**
 * [Phase 4] Scope CHỦ Ý thu hẹp so với ScenarioConfig đầy đủ ở
 * docs/simulator-architecture.md §3.3 — chỉ đủ cho chạy HEADLESS (không có
 * UI live), đúng như tên gọi "MetricsCollector + SimulationAssertions + REST
 * endpoints — Scenarios 2, 3, 7 runnable headless" của Phase 4. CHƯA hỗ trợ:
 * nhiều Flow theo trọng số (patients.flowIds), UNIFORM/POISSON arrival,
 * outageWindows/doctorLeavesAtMs (Scenario 5/6), chọn routingStrategy riêng
 * cho run (xem ghi chú currentStrategyName() trong RoutingEngineService).
 * Bổ sung dần khi các phase sau cần tới, không làm trước khi có nhu cầu cụ
 * thể.
 */
export interface CreateSimulationRunInput {
  name: string;
  seed: number;
  flowId: number;
  patientCount: number;
  arrival: SimulationArrivalConfig;
  /** 0..1, mặc định 0. */
  noShowProbability?: number;
  rooms: SimulationRoomConfig[];
  /** [Phase 5] Mặc định LOCKSTEP. */
  mode?: SimulationRunMode;
  /** [Phase 5] CHỈ có ý nghĩa khi mode = CONCURRENT — xem SimulationEngineOptions.concurrencyLimit. */
  concurrencyLimit?: number;
  /** [Phase 6] Mặc định 'ASAP' (chạy headless, hết tốc lực — hành vi Phase
   * 4). Đặt 'PACED' để xem trực tiếp trên Admin UI ở tốc độ speed×; 'STEP'
   * để dò từng sự kiện một. */
  clockPolicy?: 'ASAP' | 'PACED' | 'STEP';
  /** [Phase 6] CHỈ có ý nghĩa khi clockPolicy = 'PACED'. Mặc định 1. */
  speed?: 1 | 2 | 5 | 10 | 50;
  /** ms MÔ PHỎNG giữa 2 lần quét bất biến — mặc định 5000. */
  assertionSweepIntervalMs?: number;
  /** ms MÔ PHỎNG — mặc định 300000 (5 phút). */
  stuckThresholdMs?: number;
  /** ms MÔ PHỎNG — mặc định 60000 (1 phút). */
  routingMaxPendingMs?: number;
}
