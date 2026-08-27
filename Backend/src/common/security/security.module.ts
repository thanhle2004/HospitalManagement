import { Global, Module } from '@nestjs/common';
import { AuthRateLimitService } from './auth-rate-limit.service';

@Global()
@Module({
  providers: [AuthRateLimitService],
  exports: [AuthRateLimitService],
})
export class SecurityModule {}
