import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { getClientAddress } from '../../common/http/client-address.util';
import { AuthRateLimitService } from '../../common/security/auth-rate-limit.service';
import { RequestOtpChallengeDto } from './dto/request-otp-challenge.dto';
import { PatientAuthService } from './patient-auth.service';

@ApiTags('Patient Auth v1')
@Public()
@Controller('api/v1/patient-auth')
export class PatientAuthChallengesController {
  constructor(
    private readonly patientAuthService: PatientAuthService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Post('otp-challenges')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Yêu cầu OTP với phản hồi chống dò tồn tại số điện thoại',
  })
  requestChallenge(
    @Req() request: Request,
    @Body() dto: RequestOtpChallengeDto,
  ) {
    const address = getClientAddress(request);
    this.rateLimit.assertAllowed('patient-otp-request-ip', [address], 20, 600_000);
    this.rateLimit.assertAllowed(
      'patient-otp-request-phone',
      [dto.phone],
      5,
      600_000,
    );
    return this.patientAuthService.requestOtpChallenge(dto);
  }
}
