export interface RoomType {
  id: number;
  name: string;
  description: string | null;
  avgProcessTime: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomTypePayload {
  name: string;
  description?: string;
  avgProcessTime: number;
}

export type UpdateRoomTypePayload = Partial<CreateRoomTypePayload>;
