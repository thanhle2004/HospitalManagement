import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DeviceJwtPayload } from '../interfaces/device-jwt-payload.interface';

export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeviceJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
