export type RoomStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

export interface Room {
  id: number;
  roomNumber: string;
  name: string;
  sortOrder: number;
  /** Override theo phòng, tính bằng giây; null = kế thừa RoomType. */
  avgProcessTime: number | null;
  status: RoomStatus;
  roomType: { id: number; name: string; avgProcessTime: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomPayload {
  roomNumber: string;
  name: string;
  sortOrder: number;
  roomTypeId: number;
  /** Override theo phòng, tính bằng giây; null = kế thừa RoomType. */
  avgProcessTime?: number | null;
}

export type UpdateRoomPayload = Partial<CreateRoomPayload>;
