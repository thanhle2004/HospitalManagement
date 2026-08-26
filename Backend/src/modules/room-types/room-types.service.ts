import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomTypesRepository } from './room-types.repository';
import { RoomTypesMapper } from './room-types.mapper';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { RoomTypeResponseDto } from './dto/room-type-response.dto';

@Injectable()
export class RoomTypesService {
  constructor(private readonly roomTypesRepository: RoomTypesRepository) {}

  async create(dto: CreateRoomTypeDto): Promise<RoomTypeResponseDto> {
    const created = await this.roomTypesRepository.create(dto);
    return RoomTypesMapper.toResponseDto(created);
  }

  async findAll(): Promise<RoomTypeResponseDto[]> {
    const items = await this.roomTypesRepository.findAll();
    return RoomTypesMapper.toResponseDtoList(items);
  }

  async findById(id: number): Promise<RoomTypeResponseDto> {
    const item = await this.findOrThrow(id);
    return RoomTypesMapper.toResponseDto(item);
  }

  async update(id: number, dto: UpdateRoomTypeDto): Promise<RoomTypeResponseDto> {
    await this.findOrThrow(id);
    const updated = await this.roomTypesRepository.update(id, dto);
    return RoomTypesMapper.toResponseDto(updated);
  }

  async remove(id: number): Promise<void> {
    await this.findOrThrow(id);
    await this.roomTypesRepository.softDelete(id);
  }

  private async findOrThrow(id: number) {
    const item = await this.roomTypesRepository.findById(id);
    if (!item) {
      throw new NotFoundException(`RoomType #${id} không tồn tại`);
    }
    return item;
  }
}
