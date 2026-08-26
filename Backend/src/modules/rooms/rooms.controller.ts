import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { FindRoomsQueryDto } from './dto/find-rooms-query.dto';
import { RoomResponseDto } from './dto/room-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: '[Admin] Tạo phòng khám vật lý mới' })
  @ApiOkResponse({ type: RoomResponseDto })
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách phòng khám (lọc theo roomTypeId/status)' })
  @ApiOkResponse({ type: RoomResponseDto, isArray: true })
  findAll(@Query() query: FindRoomsQueryDto) {
    return this.roomsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết 1 phòng khám' })
  @ApiOkResponse({ type: RoomResponseDto })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.findById(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: '[Admin] Cập nhật thông tin phòng khám' })
  @ApiOkResponse({ type: RoomResponseDto })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoomDto) {
    return this.roomsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  @ApiOperation({
    summary: '[Admin] Đổi trạng thái phòng (ACTIVE/INACTIVE/MAINTENANCE)',
  })
  @ApiOkResponse({ type: RoomResponseDto })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomStatusDto,
  ) {
    return this.roomsService.updateStatus(id, dto.status);
  }
}
