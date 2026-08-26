import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { UpdateDeviceStatusDto } from './dto/update-device-status.dto';
import { FindDevicesQueryDto } from './dto/find-devices-query.dto';
import {
  DeviceResponseDto,
  DeviceWithSecretResponseDto,
} from './dto/device-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Devices')
@ApiBearerAuth()
@Roles(UserRole.ADMIN) // toàn bộ quản lý thiết bị chỉ dành cho Admin
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @ApiOperation({
    summary: '[Admin] Đăng ký thiết bị Android mới — secret CHỈ hiện 1 lần',
  })
  @ApiOkResponse({ type: DeviceWithSecretResponseDto })
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách thiết bị (lọc theo roomId)' })
  @ApiOkResponse({ type: DeviceResponseDto, isArray: true })
  findAll(@Query() query: FindDevicesQueryDto) {
    return this.devicesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết 1 thiết bị' })
  @ApiOkResponse({ type: DeviceResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.devicesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[Admin] Cập nhật thông tin thiết bị' })
  @ApiOkResponse({ type: DeviceResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeviceDto) {
    return this.devicesService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '[Admin] Bật/tắt thiết bị' })
  @ApiOkResponse({ type: DeviceResponseDto })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceStatusDto,
  ) {
    return this.devicesService.updateStatus(id, dto.status);
  }

  @Post(':id/regenerate-secret')
  @ApiOperation({
    summary: '[Admin] Cấp secret mới cho thiết bị (thất lạc/nghi lộ secret cũ)',
  })
  @ApiOkResponse({ type: DeviceWithSecretResponseDto })
  regenerateSecret(@Param('id', ParseUUIDPipe) id: string) {
    return this.devicesService.regenerateSecret(id);
  }
}
