export const VISIT_UPDATED_EVENT = 'visit.updated';

/**
 * Emit mỗi khi trạng thái 1 Visit/VisitStep thay đổi theo hướng Patient cần
 * biết (routing xong có phòng, check-in, doctor bắt đầu/hoàn thành khám...).
 * Payload CHỈ mang visitId — nơi lắng nghe (RealtimeGateway) tự tra
 * patientId khi cần, tránh mỗi service phát event phải tự query thêm.
 */
export class VisitUpdatedEvent {
  constructor(public readonly visitId: string) {}
}
