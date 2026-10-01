/**
 * Từ vựng sự kiện dùng chung giữa PatientGenerator và DoctorSimulator, chạy
 * trên CÙNG 1 SimulationEngine<PatientFlowEventType> (xem
 * docs/simulator-architecture.md §6.2). Chỉ gồm các COMMAND event mà 2 actor
 * này thực sự lên lịch/xử lý ở Phase 2 — các OBSERVATION event (VISIT_
 * CREATED, ROUTING_STARTED...) sẽ được ghi nhận riêng ở Phase 4 bằng cách
 * subscribe EventEmitter2 thật của ứng dụng, không phải do actor tự phát ra.
 *
 * Đơn giản hoá có chủ đích so với §6.2 gốc (ghi lại để phase sau biết vì
 * sao khác biệt):
 *  - Không có event DOCTOR_POLL định kỳ (self-rescheduling theo chu kỳ) —
 *    DOCTOR_POLL ở đây CHỈ được kích khi có việc thật sự cần xem lại (ngay
 *    sau QR_SCANNED, hoặc ngay sau SERVICE_END của chính phòng đó). Lý do:
 *    Phase 2 chưa có vòng đời DRAINING (§6.1) để biết khi nào dừng poll định
 *    kỳ — polling vô hạn sẽ khiến SimulationEngine không bao giờ rỗng hàng
 *    đợi để COMPLETED. Khi Phase 6 (Admin UI live) cần polling định kỳ thật
 *    sự (để phản ánh vd bác sĩ rảnh nhưng do lỗi bỏ lỡ 1 lượt), có thể thêm
 *    lại mà không phá cấu trúc hiện tại.
 *  - Không có SERVICE_START riêng — DOCTOR_POLL xử lý luôn cả việc gọi
 *    startExam() nếu phòng rảnh, vì LOCKSTEP đã đảm bảo 2 việc này atomic
 *    với nhau trong cùng 1 handler; tách ra chỉ có ý nghĩa nếu cần mốc thời
 *    gian log riêng cho "nhìn thấy hàng đợi" so với "bắt đầu khám".
 *
 * [Phase 4] Bổ sung VISIT_CREATED và SERVICE_STARTED — 2 event THUẦN GHI SỔ
 * (không có handler nào xử lý, không ai gọi service thật khi dispatch),
 * phát ra đúng lúc PatientGenerator/DoctorSimulator đã biết visitId/
 * visitStepId tương ứng. Lý do cần: MetricsCollector (chạy qua
 * SimulationEngine.onEveryEvent(), xem engine/simulation-engine.ts) tính
 * waiting time/length-of-stay/service time bằng cách đối chiếu timestamp
 * giữa các cặp event, và cần visitId (VISIT_CREATED) + visitStepId
 * (SERVICE_STARTED) có sẵn ngay trên event — PATIENT_ARRIVED chưa có
 * visitId (Visit chưa tồn tại), DOCTOR_POLL không tách riêng lúc "quyết
 * định bắt đầu khám" khỏi lúc "chỉ xem hàng đợi rồi thôi vì phòng đang bận".
 */
export type PatientFlowEventType =
  // PatientGenerator
  | 'PATIENT_ARRIVED'
  | 'VISIT_CREATED'
  | 'WALK_COMPLETED'
  | 'QR_SCANNED'
  | 'PATIENT_NO_SHOW'
  | 'CONTINUE_VISIT'
  | 'VISIT_COMPLETED'
  // DoctorSimulator
  | 'DOCTOR_POLL'
  | 'SERVICE_STARTED'
  | 'SERVICE_END'
  // [Phase 4] SimulationOrchestrator — không thuộc về patient hay doctor,
  // nhưng chạy trên CÙNG 1 engine nên cần góp mặt ở đây (xem lý giải trong
  // giữ 1 union duy nhất thay vì hợp nhất 2 kiểu generic khác nhau).
  | 'ASSERTION_SWEEP';

export interface PatientFlowPayload {
  /** Chỉ có ở PATIENT_ARRIVED — patientId tổng hợp sẽ "đăng ký" Visit mới. */
  patientId?: string;
  /** Chỉ có ở PATIENT_ARRIVED. */
  flowId?: number;
  /** Chỉ có ở WALK_COMPLETED/QR_SCANNED — token QR lấy từ VisitDetailResponseDto.steps[].assignment.qrToken. */
  qrToken?: string;
  /** Chỉ có ở SERVICE_END — bác sĩ nào vừa startExam(), gắn với assignmentId nào. */
  doctorId?: string;
  assignmentId?: number;
}

/** Ánh xạ roomId -> deviceId/doctorId tổng hợp của 1 SimulationRun, dựng từ
 * ProvisionedRoomFixture[] (kết quả của SimulationFixturesService.
 * provisionFixtures() — Phase 0). 2 actor không tự tra Phase 0's fixtures —
 * SimulationOrchestrator (Phase 4) dựng map này 1 lần rồi truyền vào cả hai. */
export interface RoomFixtureMaps {
  roomIdToDeviceId: Map<number, string>;
  roomIdToDoctorId: Map<number, string>;
}

export function buildRoomFixtureMaps(
  rooms: ReadonlyArray<{ roomId: number; doctorUserId: string | null; deviceId: string | null }>,
): RoomFixtureMaps {
  const roomIdToDeviceId = new Map<number, string>();
  const roomIdToDoctorId = new Map<number, string>();
  for (const room of rooms) {
    if (room.deviceId) roomIdToDeviceId.set(room.roomId, room.deviceId);
    if (room.doctorUserId) roomIdToDoctorId.set(room.roomId, room.doctorUserId);
  }
  return { roomIdToDeviceId, roomIdToDoctorId };
}