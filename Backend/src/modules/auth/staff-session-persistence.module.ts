import { Module } from '@nestjs/common';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';

@Module({
  providers: [RefreshTokenRepository],
  exports: [RefreshTokenRepository],
})
export class StaffSessionPersistenceModule {}
