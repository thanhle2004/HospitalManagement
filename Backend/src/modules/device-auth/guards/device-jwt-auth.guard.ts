import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Giống PatientJwtAuthGuard — KHÔNG global, gắn thủ công @UseGuards() ở route Device cần */
@Injectable()
export class DeviceJwtAuthGuard extends AuthGuard('device-jwt') {}
