import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckInService } from './check-in.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckInResponseDto } from './dto/check-in-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { DeviceJwtAuthGuard } from '../device-auth/guards/device-jwt-auth.guard';
import { CurrentDevice } from '../device-auth/decorators/current-device.decorator';
import { DeviceJwtPayload } from '../device-auth/interfaces/device-jwt-payload.interface';

@ApiTags('Check-in')
@ApiBearerAuth()
@Public() // bỏ qua JwtAuthGuard (Staff, global) — DeviceJwtAuthGuard tự xác thực riêng
@UseGuards(DeviceJwtAuthGuard)
@Controller('check-in')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post()
  @ApiOperation({
    summary: '[Device] Quét QR để check-in bệnh nhân vào đúng phòng khám',
  })
  @ApiOkResponse({ type: CheckInResponseDto })
  checkIn(@CurrentDevice() device: DeviceJwtPayload, @Body() dto: CheckInDto) {
    return this.checkInService.checkIn(device.sub, dto);
  }
}
