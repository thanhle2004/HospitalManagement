import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomStatus, UserRole } from '@prisma/client';
import { DoctorAssignmentsRepository } from './repositories/doctor-assignments.repository';
import { DoctorAssignmentsMapper } from './doctor-assignments.mapper';
import { UsersRepository } from '../users/users.repository';
import { RoomsRepository } from '../rooms/rooms.repository';
import { CreateDoctorAssignmentDto } from './dto/create-doctor-assignment.dto';
import { DoctorAssignmentResponseDto } from './dto/doctor-assignment-response.dto';

@Injectable()
export class DoctorAssignmentsService {
  constructor(
    private readonly doctorAssignmentsRepository: DoctorAssignmentsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly roomsRepository: RoomsRepository,
  ) {}

  async create(
    dto: CreateDoctorAssignmentDto,
  ): Promise<DoctorAssignmentResponseDto> {
    const doctor = await this.usersRepository.findById(dto.doctorId);
    if (!doctor || doctor.role !== UserRole.DOCTOR) {
      throw new NotFoundException(`Doctor #${dto.doctorId} không tồn tại`);
    }

    const room = await this.roomsRepository.findById(dto.roomId);
    if (!room) {
      throw new NotFoundException(`Room #${dto.roomId} không tồn tại`);
    }
    if (room.status !== RoomStatus.ACTIVE) {
      throw new ConflictException('Chỉ có thể phân ca vào phòng đang hoạt động');
    }

    await this.assertNoOverlap(
      dto.doctorId,
      dto.roomId,
      dto.startTime,
      dto.endTime ?? null,
    );

    const created = await this.doctorAssignmentsRepository.create({
      doctor: { connect: { id: dto.doctorId } },
      room: { connect: { id: dto.roomId } },
      startTime: dto.startTime,
      endTime: dto.endTime,
    });

    const withRelations = await this.doctorAssignmentsRepository.findById(
      created.id,
    );
    return DoctorAssignmentsMapper.toResponseDto(withRelations!);
  }

  async findAll(filter: {
    doctorId?: string;
    roomId?: number;
    activeOnly?: boolean;
  }): Promise<DoctorAssignmentResponseDto[]> {
    const items = await this.doctorAssignmentsRepository.findAll(filter);
    return DoctorAssignmentsMapper.toResponseDtoList(items);
  }

  async findById(id: number): Promise<DoctorAssignmentResponseDto> {
    const item = await this.findOrThrow(id);
    return DoctorAssignmentsMapper.toResponseDto(item);
  }

  async endShift(id: number): Promise<DoctorAssignmentResponseDto> {
    await this.findOrThrow(id);
    await this.doctorAssignmentsRepository.endShift(id, new Date());
    const updated = await this.doctorAssignmentsRepository.findById(id);
    return DoctorAssignmentsMapper.toResponseDto(updated!);
  }

  async remove(id: number): Promise<void> {
    await this.findOrThrow(id);
    await this.doctorAssignmentsRepository.delete(id);
  }

  private async findOrThrow(id: number) {
    const item = await this.doctorAssignmentsRepository.findById(id);
    if (!item) {
      throw new NotFoundException(`DoctorAssignment #${id} không tồn tại`);
    }
    return item;
  }

  /**
   * Chặn overlap ở tầng service — KHÔNG thể enforce bằng constraint khai báo
   * trong Prisma/MySQL (đã ghi chú trong schema.prisma). excludeId dùng khi
   * sau này có API sửa giờ ca trực (hiện chưa có, chỉ có tạo mới/kết thúc sớm).
   */
  private async assertNoOverlap(
    doctorId: string,
    roomId: number,
    startTime: Date,
    endTime: Date | null,
    excludeId?: number,
  ): Promise<void> {
    const overlapping = await this.doctorAssignmentsRepository.findOverlapping(
      doctorId,
      startTime,
      endTime,
      excludeId,
    );

    if (overlapping.length > 0) {
      throw new ConflictException(
        'Doctor đã có ca trực khác trong khoảng thời gian này',
      );
    }

    const roomOverlapping =
      await this.doctorAssignmentsRepository.findRoomOverlapping(
        roomId,
        startTime,
        endTime,
        excludeId,
      );
    if (roomOverlapping.length > 0) {
      throw new ConflictException(
        'Phòng khám đã có bác sĩ trực trong khoảng thời gian này',
      );
    }
  }
}
