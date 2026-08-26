export const ROOM_QUEUE_UPDATED_EVENT = 'room-queue.updated';

/** Emit khi RoomQueueEntry của 1 phòng thay đổi (check-in thêm vào / doctor complete dequeue) */
export class RoomQueueUpdatedEvent {
  constructor(public readonly roomId: number) {}
}
