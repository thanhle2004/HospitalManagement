import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Admin quản lý Doctor ────────────────────────────────────────────

  @Roles(UserRole.ADMIN)
  @Post('doctors')
  @ApiOperation({ summary: '[Admin] Tạo tài khoản Doctor mới' })
  @ApiCreatedResponse({ type: UserResponseDto })
  createDoctor(@Body() dto: CreateDoctorDto) {
    return this.usersService.createDoctor(dto);
  }

  @Roles(UserRole.ADMIN)
  @Get('doctors')
  @ApiOperation({ summary: '[Admin] Danh sách Doctor' })
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  listDoctors() {
    return this.usersService.listDoctors();
  }

  @Roles(UserRole.ADMIN)
  @Get('doctors/:id')
  @ApiOperation({ summary: '[Admin] Chi tiết 1 Doctor' })
  @ApiOkResponse({ type: UserResponseDto })
  getDoctor(@Param('id') id: string) {
    return this.usersService.findDoctorById(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch('doctors/:id/lock')
  @ApiOperation({ summary: '[Admin] Khoá tài khoản Doctor' })
  @ApiOkResponse({ type: UserResponseDto })
  lockDoctor(@Param('id') id: string) {
    return this.usersService.setStatus(id, UserStatus.LOCKED);
  }

  @Roles(UserRole.ADMIN)
  @Patch('doctors/:id/unlock')
  @ApiOperation({ summary: '[Admin] Mở khoá tài khoản Doctor' })
  @ApiOkResponse({ type: UserResponseDto })
  unlockDoctor(@Param('id') id: string) {
    return this.usersService.setStatus(id, UserStatus.ACTIVE);
  }

  // ── Self-service (Admin hoặc Doctor đều dùng được — không gắn @Roles) ─

  @Get('me')
  @ApiOperation({ summary: 'Thông tin tài khoản đang đăng nhập' })
  @ApiOkResponse({ type: UserResponseDto })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật profile của chính mình' })
  @ApiOkResponse({ type: UserResponseDto })
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đổi mật khẩu của chính mình' })
  async changeMyPassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.usersService.changePassword(user.sub, dto);
  }
}
