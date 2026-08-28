import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PatientAuthService } from './patient-auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyRegisterDto } from './dto/verify-register.dto';
import { VerifyLoginDto } from './dto/verify-login.dto';
import { PatientRefreshTokenDto } from './dto/patient-refresh-token.dto';
import { PatientTokenResponseDto } from './dto/patient-token-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { PatientJwtAuthGuard } from './guards/patient-jwt-auth.guard';
import { CurrentPatient } from './decorators/current-patient.decorator';
import { PatientJwtPayload } from './interfaces/patient-jwt-payload.interface';
import type { Request } from 'express';
import { AuthRateLimitService } from '../../common/security/auth-rate-limit.service';
import { getClientAddress } from '../../common/http/client-address.util';
import { PatientPhoneVerificationResponseDto } from './dto/patient-phone-verification-response.dto';
import { CompletePatientRegistrationDto } from './dto/complete-patient-registration.dto';
import { VerifyFirebasePhoneDto } from './dto/verify-firebase-phone.dto';
import { FirebasePhoneAuthService } from './firebase-phone-auth.service';

@ApiTags('Patient Auth')
@Public() // Toàn bộ controller này bỏ qua JwtAuthGuard (Staff, global) — patient dùng token khác hẳn
@Controller('patient-auth')
export class PatientAuthController {
  constructor(
    private readonly patientAuthService: PatientAuthService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly firebasePhoneAuth: FirebasePhoneAuthService,
  ) {}

  @Post('firebase/session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xác minh Firebase Phone ID token rồi đăng nhập hoặc mở đăng ký',
  })
  @ApiOkResponse({ type: PatientPhoneVerificationResponseDto })
  async createFirebaseSession(
    @Req() request: Request,
    @Body() dto: VerifyFirebasePhoneDto,
  ) {
    const address = getClientAddress(request);
    this.rateLimit.assertAllowed(
      'patient-firebase-session-ip',
      [address],
      30,
      600_000,
    );
    const phone = await this.firebasePhoneAuth.verifyPhoneNumber(
      dto.firebaseIdToken,
    );
    this.rateLimit.assertAllowed(
      'patient-firebase-session-phone',
      [phone],
      10,
      600_000,
    );
    return this.patientAuthService.authenticateVerifiedPhone(phone);
  }

  @Post('phone/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi OTP; server tự xác định số cũ để đăng nhập hay số mới để đăng ký',
  })
  requestPhoneOtp(@Req() request: Request, @Body() dto: RequestOtpDto) {
    this.limitOtpRequest(request, dto.phone);
    return this.patientAuthService.requestPhoneOtp(dto);
  }

  @Post('phone/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xác thực OTP và tự đăng nhập hoặc yêu cầu hoàn thiện hồ sơ',
  })
  @ApiOkResponse({ type: PatientPhoneVerificationResponseDto })
  verifyPhone(@Req() request: Request, @Body() dto: VerifyLoginDto) {
    this.limitOtpVerify(request, dto.phone);
    return this.patientAuthService.verifyPhone(dto);
  }

  @Post('phone/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Hoàn thiện hồ sơ sau khi số điện thoại mới đã xác thực OTP' })
  @ApiOkResponse({ type: PatientTokenResponseDto })
  completePhoneRegistration(@Body() dto: CompletePatientRegistrationDto) {
    return this.patientAuthService.completePhoneRegistration(dto);
  }

  @Post('register/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi OTP cho luồng đăng ký tài khoản Patient mới' })
  requestRegisterOtp(@Req() request: Request, @Body() dto: RequestOtpDto) {
    this.limitOtpRequest(request, dto.phone);
    return this.patientAuthService.requestRegisterOtp(dto);
  }

  @Post('register/verify')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Xác thực OTP + tạo hồ sơ Patient (lần đăng ký đầu tiên)',
  })
  @ApiOkResponse({ type: PatientTokenResponseDto })
  verifyRegister(@Req() request: Request, @Body() dto: VerifyRegisterDto) {
    this.limitOtpVerify(request, dto.phone);
    return this.patientAuthService.verifyRegister(dto);
  }

  @Post('login/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi OTP cho luồng đăng nhập (đã có tài khoản)' })
  requestLoginOtp(@Req() request: Request, @Body() dto: RequestOtpDto) {
    this.limitOtpRequest(request, dto.phone);
    return this.patientAuthService.requestLoginOtp(dto);
  }

  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực OTP đăng nhập' })
  @ApiOkResponse({ type: PatientTokenResponseDto })
  verifyLogin(@Req() request: Request, @Body() dto: VerifyLoginDto) {
    this.limitOtpVerify(request, dto.phone);
    return this.patientAuthService.verifyLogin(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cấp access token mới từ refresh token (có rotation)' })
  @ApiOkResponse({ type: PatientTokenResponseDto })
  refresh(@Req() request: Request, @Body() dto: PatientRefreshTokenDto) {
    const address = getClientAddress(request);
    this.rateLimit.assertAllowed('patient-refresh-ip', [address], 60, 60_000);
    this.rateLimit.assertAllowed(
      'patient-refresh-token',
      [dto.refreshToken],
      10,
      60_000,
    );
    return this.patientAuthService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(PatientJwtAuthGuard) // route duy nhất trong controller này cần JWT Patient hợp lệ
  @ApiOperation({ summary: 'Revoke toàn bộ session của Patient hiện tại' })
  async logout(@CurrentPatient() patient: PatientJwtPayload): Promise<void> {
    await this.patientAuthService.logout(patient.sub);
  }

  private limitOtpRequest(request: Request, phone: string): void {
    const address = getClientAddress(request);
    this.rateLimit.assertAllowed('patient-otp-request-ip', [address], 20, 600_000);
    this.rateLimit.assertAllowed(
      'patient-otp-request-phone',
      [phone],
      5,
      600_000,
    );
  }

  private limitOtpVerify(request: Request, phone: string): void {
    const address = getClientAddress(request);
    this.rateLimit.assertAllowed('patient-otp-verify-ip', [address], 30, 600_000);
    this.rateLimit.assertAllowed(
      'patient-otp-verify-phone',
      [phone],
      10,
      600_000,
    );
  }
}
