import { DeviceWithRoom } from './devices.repository';
import { DeviceResponseDto, DeviceWithSecretResponseDto } from './dto/device-response.dto';

export class DevicesMapper {
  static toResponseDto(device: DeviceWithRoom): DeviceResponseDto {
    return {
      id: device.id,
      code: device.code,
      name: device.name,
      type: device.type,
      status: device.status,
      lastHeartbeatAt: device.lastHeartbeatAt,
      appVersion: device.appVersion,
      room: {
        id: device.room.id,
        roomNumber: device.room.roomNumber,
        name: device.room.name,
      },
      createdAt: device.createdAt,
      // secretKeyHash bị loại bỏ có chủ đích
    };
  }

  static toResponseDtoList(devices: DeviceWithRoom[]): DeviceResponseDto[] {
    return devices.map((d) => this.toResponseDto(d));
  }

  static toResponseWithSecret(
    device: DeviceWithRoom,
    secret: string,
  ): DeviceWithSecretResponseDto {
    return { ...this.toResponseDto(device), secret };
  }
}
