import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
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

@ApiTags('Patient Auth')
@Public() // Toàn bộ controller này bỏ qua JwtAuthGuard (Staff, global) — patient dùng token khác hẳn
@Controller('patient-auth')
export class PatientAuthController {
  constructor(private readonly patientAuthService: PatientAuthService) {}

  @Post('register/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi OTP cho luồng đăng ký tài khoản Patient mới' })
  requestRegisterOtp(@Body() dto: RequestOtpDto) {
    return this.patientAuthService.requestRegisterOtp(dto);
  }

  @Post('register/verify')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Xác thực OTP + tạo hồ sơ Patient (lần đăng ký đầu tiên)',
  })
  @ApiOkResponse({ type: PatientTokenResponseDto })
  verifyRegister(@Body() dto: VerifyRegisterDto) {
    return this.patientAuthService.verifyRegister(dto);
  }

  @Post('login/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi OTP cho luồng đăng nhập (đã có tài khoản)' })
  requestLoginOtp(@Body() dto: RequestOtpDto) {
    return this.patientAuthService.requestLoginOtp(dto);
  }

  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực OTP đăng nhập' })
  @ApiOkResponse({ type: PatientTokenResponseDto })
  verifyLogin(@Body() dto: VerifyLoginDto) {
    return this.patientAuthService.verifyLogin(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cấp access token mới từ refresh token (có rotation)' })
  @ApiOkResponse({ type: PatientTokenResponseDto })
  refresh(@Body() dto: PatientRefreshTokenDto) {
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
}
