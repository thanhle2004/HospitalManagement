import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RoomTypesService } from './room-types.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { RoomTypeResponseDto } from './dto/room-type-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Room Types')
@ApiBearerAuth()
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypesService: RoomTypesService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: '[Admin] Tạo loại phòng khám mới' })
  @ApiOkResponse({ type: RoomTypeResponseDto })
  create(@Body() dto: CreateRoomTypeDto) {
    return this.roomTypesService.create(dto);
  }

  // Không @Roles() => mọi Staff (Admin lẫn Doctor) đều xem được danh sách
  @Get()
  @ApiOperation({ summary: 'Danh sách loại phòng khám' })
  @ApiOkResponse({ type: RoomTypeResponseDto, isArray: true })
  findAll() {
    return this.roomTypesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết 1 loại phòng khám' })
  @ApiOkResponse({ type: RoomTypeResponseDto })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.roomTypesService.findById(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: '[Admin] Cập nhật loại phòng khám' })
  @ApiOkResponse({ type: RoomTypeResponseDto })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoomTypeDto) {
    return this.roomTypesService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xoá (soft-delete) loại phòng khám' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.roomTypesService.remove(id);
  }
}
