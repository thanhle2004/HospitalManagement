import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'NestJS + Prisma + MySQL API đang chạy 🚀';
  }
}
