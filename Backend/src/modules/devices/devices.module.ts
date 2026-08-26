import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DevicesRepository } from './devices.repository';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [RoomsModule], // dùng RoomsRepository để validate roomId tồn tại
  controllers: [DevicesController],
  providers: [DevicesService, DevicesRepository],
  exports: [DevicesRepository],
})
export class DevicesModule {}
