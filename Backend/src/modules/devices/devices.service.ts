import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DeviceStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DevicesRepository } from './devices.repository';
import { DevicesMapper } from './devices.mapper';
import { RoomsRepository } from '../rooms/rooms.repository';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import {
  DeviceResponseDto,
  DeviceWithSecretResponseDto,
} from './dto/device-response.dto';
import { generateDeviceSecret } from './utils/generate-device-secret.util';

const SECRET_SALT_ROUNDS = 10;

@Injectable()
export class DevicesService {
  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly roomsRepository: RoomsRepository,
  ) {}

  /** Secret gốc CHỈ trả về đúng 1 lần ở response này — không thể xem lại sau, chỉ regenerate mới */
  async create(dto: CreateDeviceDto): Promise<DeviceWithSecretResponseDto> {
    await this.assertRoomExists(dto.roomId);

    const existing = await this.devicesRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(`Code "${dto.code}" đã tồn tại`);
    }

    const secret = generateDeviceSecret();
    const secretKeyHash = await bcrypt.hash(secret, SECRET_SALT_ROUNDS);

    const created = await this.devicesRepository.create({
      code: dto.code,
      name: dto.name,
      type: dto.type,
      secretKeyHash,
      room: { connect: { id: dto.roomId } },
    });

    const withRoom = await this.devicesRepository.findById(created.id);
    return DevicesMapper.toResponseWithSecret(withRoom!, secret);
  }

  async findAll(filter: { roomId?: number }): Promise<DeviceResponseDto[]> {
    const devices = await this.devicesRepository.findAll(filter);
    return DevicesMapper.toResponseDtoList(devices);
  }

  async findById(id: string): Promise<DeviceResponseDto> {
    const device = await this.findOrThrow(id);
    return DevicesMapper.toResponseDto(device);
  }

  async update(id: string, dto: UpdateDeviceDto): Promise<DeviceResponseDto> {
    await this.findOrThrow(id);

    if (dto.roomId) {
      await this.assertRoomExists(dto.roomId);
    }

    await this.devicesRepository.update(id, {
      name: dto.name,
      appVersion: dto.appVersion,
      room: dto.roomId ? { connect: { id: dto.roomId } } : undefined,
    });

    const updated = await this.devicesRepository.findById(id);
    return DevicesMapper.toResponseDto(updated!);
  }

  async updateStatus(id: string, status: DeviceStatus): Promise<DeviceResponseDto> {
    await this.findOrThrow(id);
    await this.devicesRepository.updateStatus(id, status);
    const updated = await this.devicesRepository.findById(id);
    return DevicesMapper.toResponseDto(updated!);
  }

  /** Cấp secret mới — secret cũ ngay lập tức không dùng được nữa (device thất lạc, nghi lộ secret...) */
  async regenerateSecret(id: string): Promise<DeviceWithSecretResponseDto> {
    const device = await this.findOrThrow(id);

    const secret = generateDeviceSecret();
    const secretKeyHash = await bcrypt.hash(secret, SECRET_SALT_ROUNDS);
    await this.devicesRepository.updateSecret(id, secretKeyHash);

    return DevicesMapper.toResponseWithSecret(device, secret);
  }

  private async findOrThrow(id: string) {
    const device = await this.devicesRepository.findById(id);
    if (!device) {
      throw new NotFoundException(`Device #${id} không tồn tại`);
    }
    return device;
  }

  private async assertRoomExists(roomId: number): Promise<void> {
    const room = await this.roomsRepository.findById(roomId);
    if (!room) {
      throw new NotFoundException(`Room #${roomId} không tồn tại`);
    }
  }
}
