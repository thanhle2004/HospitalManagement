import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomsRepository } from './rooms.repository';
import { RoomRuntimeRepository } from './room-runtime.repository';
import { RoomTypesModule } from '../room-types/room-types.module';

@Module({
  imports: [RoomTypesModule], // dùng RoomTypesRepository để validate roomTypeId tồn tại
  controllers: [RoomsController],
  providers: [RoomsService, RoomsRepository, RoomRuntimeRepository],
  exports: [RoomsRepository, RoomRuntimeRepository],
})
export class RoomsModule {}
