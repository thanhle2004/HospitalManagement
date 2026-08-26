import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from './users.repository';
import { UsersMapper } from './users.mapper';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserResponseDto } from './dto/user-response.dto';

const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Unit of Work: tạo User (role=DOCTOR) + UserProfile trong CÙNG 1
   * transaction. Nếu tạo profile lỗi, tài khoản Doctor cũng rollback —
   * tránh để lại User không có hồ sơ cá nhân đi kèm.
   */
  async createDoctor(dto: CreateDoctorDto): Promise<UserResponseDto> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);

    const user = await this.prisma.transaction(async (tx) => {
      const created = await this.usersRepository.createStaff(
        {
          email: dto.email,
          passwordHash,
          role: UserRole.DOCTOR,
        },
        tx,
      );

      await this.usersRepository.createProfile(
        {
          user: { connect: { id: created.id } },
          fullName: dto.fullName,
          phone: dto.phone,
          gender: dto.gender,
          birthday: dto.birthday,
          address: dto.address,
        },
        tx,
      );

      return this.usersRepository.findById(created.id, tx);
    });

    return UsersMapper.toResponseDto(user!);
  }

  async listDoctors(): Promise<UserResponseDto[]> {
    const doctors = await this.usersRepository.findAllByRole(UserRole.DOCTOR);
    return UsersMapper.toResponseDtoList(doctors);
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.findOrThrow(id);
    return UsersMapper.toResponseDto(user);
  }

  async setStatus(id: string, status: UserStatus): Promise<UserResponseDto> {
    await this.findOrThrow(id);
    await this.usersRepository.updateStatus(id, status);
    const updated = await this.usersRepository.findById(id);
    return UsersMapper.toResponseDto(updated!);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    await this.findOrThrow(userId);

    await this.usersRepository.updateProfile(userId, dto);

    const updated = await this.usersRepository.findById(userId);
    return UsersMapper.toResponseDto(updated!);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findOrThrow(userId);

    const matches = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Mật khẩu cũ không đúng');
    }

    const newHash = await bcrypt.hash(dto.newPassword, PASSWORD_SALT_ROUNDS);
    await this.usersRepository.updatePassword(userId, newHash);
  }

  private async findOrThrow(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User #${id} không tồn tại`);
    }
    return user;
  }
}
