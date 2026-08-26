import { RoomType } from '@prisma/client';
import { RoomTypeResponseDto } from './dto/room-type-response.dto';

export class RoomTypesMapper {
  static toResponseDto(roomType: RoomType): RoomTypeResponseDto {
    return {
      id: roomType.id,
      name: roomType.name,
      description: roomType.description,
      avgProcessTime: roomType.avgProcessTime,
      createdAt: roomType.createdAt,
      updatedAt: roomType.updatedAt,
    };
  }

  static toResponseDtoList(roomTypes: RoomType[]): RoomTypeResponseDto[] {
    return roomTypes.map((r) => this.toResponseDto(r));
  }
}
