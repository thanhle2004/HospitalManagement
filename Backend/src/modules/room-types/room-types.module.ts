import { Module } from '@nestjs/common';
import { RoomTypesController } from './room-types.controller';
import { RoomTypesService } from './room-types.service';
import { RoomTypesRepository } from './room-types.repository';

@Module({
  controllers: [RoomTypesController],
  providers: [RoomTypesService, RoomTypesRepository],
  exports: [RoomTypesRepository],
})
export class RoomTypesModule {}
