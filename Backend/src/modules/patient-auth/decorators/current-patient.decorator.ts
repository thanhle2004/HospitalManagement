import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PatientJwtPayload } from '../interfaces/patient-jwt-payload.interface';

/** Lấy payload JWT đã đối chiếu DB (sub, tokenVersion) của Patient hiện tại. */
export const CurrentPatient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PatientJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
