import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PatientJwtPayload } from '../interfaces/patient-jwt-payload.interface';

/** Lấy payload JWT (sub, phone) của Patient hiện tại — dùng: @CurrentPatient() patient: PatientJwtPayload */
export const CurrentPatient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PatientJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
