import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsRepository } from './rooms.repository';
import { RoomRuntimeRepository } from './room-runtime.repository';
import { RoomsMapper } from './rooms.mapper';
import { RoomTypesRepository } from '../room-types/room-types.repository';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomResponseDto } from './dto/room-response.dto';

@Injectable()
export class RoomsService {
  constructor(
    private readonly roomsRepository: RoomsRepository,
    private readonly roomRuntimeRepository: RoomRuntimeRepository,
    private readonly roomTypesRepository: RoomTypesRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Unit of Work: tạo Room + RoomRuntime (dùng cho optimistic locking ở
   * Phase 8 — Doctor bắt đầu khám) trong cùng 1 transaction. Room không
   * bao giờ tồn tại mà thiếu RoomRuntime đi kèm.
   */
  async create(dto: CreateRoomDto): Promise<RoomResponseDto> {
    await this.assertRoomTypeExists(dto.roomTypeId);

    const existing = await this.roomsRepository.findByRoomNumber(dto.roomNumber);
    if (existing) {
      throw new ConflictException(`Số phòng "${dto.roomNumber}" đã tồn tại`);
    }

    const createdId = await this.prisma.transaction(async (tx) => {
      const created = await this.roomsRepository.create(
        {
          roomNumber: dto.roomNumber,
          name: dto.name,
          sortOrder: dto.sortOrder,
          roomType: { connect: { id: dto.roomTypeId } },
        },
        tx,
      );
      await this.roomRuntimeRepository.ensureExists(created.id, tx);
      return created.id;
    });

    const withType = await this.roomsRepository.findById(createdId);
    return RoomsMapper.toResponseDto(withType!);
  }

  async findAll(filter: {
    roomTypeId?: number;
    status?: RoomStatus;
  }): Promise<RoomResponseDto[]> {
    const rooms = await this.roomsRepository.findAll(filter);
    return RoomsMapper.toResponseDtoList(rooms);
  }

  async findById(id: number): Promise<RoomResponseDto> {
    const room = await this.findOrThrow(id);
    return RoomsMapper.toResponseDto(room);
  }

  async update(id: number, dto: UpdateRoomDto): Promise<RoomResponseDto> {
    await this.findOrThrow(id);

    if (dto.roomTypeId) {
      await this.assertRoomTypeExists(dto.roomTypeId);
    }

    if (dto.roomNumber) {
      const existing = await this.roomsRepository.findByRoomNumber(dto.roomNumber);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Số phòng "${dto.roomNumber}" đã tồn tại`);
      }
    }

    await this.roomsRepository.update(id, {
      roomNumber: dto.roomNumber,
      name: dto.name,
      sortOrder: dto.sortOrder,
      roomType: dto.roomTypeId ? { connect: { id: dto.roomTypeId } } : undefined,
    });

    const updated = await this.roomsRepository.findById(id);
    return RoomsMapper.toResponseDto(updated!);
  }

  async updateStatus(id: number, status: RoomStatus): Promise<RoomResponseDto> {
    await this.findOrThrow(id);
    await this.roomsRepository.updateStatus(id, status);
    const updated = await this.roomsRepository.findById(id);
    return RoomsMapper.toResponseDto(updated!);
  }

  private async findOrThrow(id: number) {
    const room = await this.roomsRepository.findById(id);
    if (!room) {
      throw new NotFoundException(`Room #${id} không tồn tại`);
    }
    return room;
  }

  private async assertRoomTypeExists(roomTypeId: number): Promise<void> {
    const roomType = await this.roomTypesRepository.findById(roomTypeId);
    if (!roomType) {
      throw new NotFoundException(`RoomType #${roomTypeId} không tồn tại`);
    }
  }
}
