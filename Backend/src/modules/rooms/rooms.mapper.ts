import { RoomWithType } from './rooms.repository';
import { RoomResponseDto } from './dto/room-response.dto';

export class RoomsMapper {
  static toResponseDto(room: RoomWithType): RoomResponseDto {
    return {
      id: room.id,
      roomNumber: room.roomNumber,
      name: room.name,
      sortOrder: room.sortOrder,
      status: room.status,
      roomType: { id: room.roomType.id, name: room.roomType.name },
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  static toResponseDtoList(rooms: RoomWithType[]): RoomResponseDto[] {
    return rooms.map((r) => this.toResponseDto(r));
  }
}
