export type RoomStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

export interface Room {
  id: number;
  roomNumber: string;
  name: string;
  sortOrder: number;
  status: RoomStatus;
  roomType: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomPayload {
  roomNumber: string;
  name: string;
  sortOrder: number;
  roomTypeId: number;
}

export type UpdateRoomPayload = Partial<CreateRoomPayload>;
