import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService authorization boundaries', () => {
  it('does not let Doctor management endpoints target an Admin account', async () => {
    const usersRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'admin-1',
        role: UserRole.ADMIN,
      }),
      updateStatus: jest.fn(),
    };
    const service = new UsersService(
      usersRepository as unknown as UsersRepository,
      {} as PrismaService,
    );

    await expect(service.findDoctorById('admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(usersRepository.updateStatus).not.toHaveBeenCalled();
  });
});
