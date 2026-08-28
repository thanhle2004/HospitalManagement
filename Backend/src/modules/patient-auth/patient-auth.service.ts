import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientsRepository } from '../patients/patients.repository';
import { PatientOtpRepository } from './repositories/patient-otp.repository';
import { PatientSessionRepository } from './repositories/patient-session.repository';
import { OtpSenderService } from './otp-sender.service';
import { generateOtpCode } from './utils/generate-otp.util';
import { hashToken } from '../auth/utils/hash-token.util';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyRegisterDto } from './dto/verify-register.dto';
import { VerifyLoginDto } from './dto/verify-login.dto';
import { PatientRefreshTokenDto } from './dto/patient-refresh-token.dto';
import { PatientTokenResponseDto } from './dto/patient-token-response.dto';
import { PatientJwtPayload } from './interfaces/patient-jwt-payload.interface';
import { RequestOtpChallengeDto } from './dto/request-otp-challenge.dto';
import {
  PatientPhoneVerificationResponse,
} from './dto/patient-phone-verification-response.dto';
import { CompletePatientRegistrationDto } from './dto/complete-patient-registration.dto';

const OTP_SALT_ROUNDS = 10;
const REGISTRATION_TOKEN_PURPOSE = 'PATIENT_REGISTRATION';

interface PatientRegistrationTokenPayload {
  phone: string;
  purpose: typeof REGISTRATION_TOKEN_PURPOSE;
}

@Injectable()
export class PatientAuthService {
  constructor(
    private readonly patientsRepository: PatientsRepository,
    private readonly patientOtpRepository: PatientOtpRepository,
    private readonly patientSessionRepository: PatientSessionRepository,
    private readonly otpSender: OtpSenderService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * API v1 chống account enumeration: dù phone/purpose có khớp trạng thái
   * tài khoản hay đang cooldown, client luôn nhận cùng một phản hồi.
   * Các endpoint legacy vẫn được giữ nguyên cho ứng dụng cũ.
   */
  async requestOtpChallenge(
    dto: RequestOtpChallengeDto,
  ): Promise<{ message: string }> {
    const genericResponse = {
      message: 'Nếu yêu cầu hợp lệ, mã OTP sẽ được gửi',
    };
    const patient = await this.patientsRepository.findByPhone(dto.phone);
    const stateMatches =
      (dto.purpose === OtpPurpose.REGISTER && !patient) ||
      (dto.purpose === OtpPurpose.LOGIN && !!patient);

    if (!stateMatches) {
      await this.simulateOtpHashWork();
      return genericResponse;
    }

    try {
      await this.assertResendCooldown(dto.phone, dto.purpose);
    } catch (error) {
      if (error instanceof BadRequestException) return genericResponse;
      throw error;
    }

    await this.createAndSendOtp(dto.phone, dto.purpose, patient?.id ?? null);
    return genericResponse;
  }

  /**
   * Luồng mobile thống nhất: server tự xác định OTP dùng để đăng nhập hay
   * đăng ký nhưng luôn trả cùng một thông báo, không làm lộ số đã tồn tại.
   */
  async requestPhoneOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const genericResponse = { message: 'Nếu yêu cầu hợp lệ, mã OTP sẽ được gửi' };
    const patient = await this.patientsRepository.findByPhone(dto.phone);
    const purpose = patient ? OtpPurpose.LOGIN : OtpPurpose.REGISTER;

    try {
      await this.assertResendCooldown(dto.phone, purpose);
    } catch (error) {
      if (error instanceof BadRequestException) return genericResponse;
      throw error;
    }

    await this.createAndSendOtp(dto.phone, purpose, patient?.id ?? null);
    return genericResponse;
  }

  /**
   * Chỉ sau khi OTP hợp lệ mới trả kết quả số cũ/mới. Số cũ nhận phiên đăng
   * nhập ngay; số mới nhận ticket ký số ngắn hạn để hoàn thiện hồ sơ.
   */
  async verifyPhone(
    dto: VerifyLoginDto,
  ): Promise<PatientPhoneVerificationResponse> {
    const patient = await this.patientsRepository.findByPhone(dto.phone);
    const purpose = patient ? OtpPurpose.LOGIN : OtpPurpose.REGISTER;
    const otp = await this.verifyOtpOrThrow(dto.phone, dto.otp, purpose);

    if (!patient) {
      const consumed = await this.patientOtpRepository.consumeIfUnused(otp.id);
      if (consumed.count !== 1) {
        throw new UnauthorizedException('Mã OTP đã được sử dụng');
      }

      const registrationToken = await this.jwtService.signAsync(
        { phone: dto.phone, purpose: REGISTRATION_TOKEN_PURPOSE },
        {
          secret: this.registrationTokenSecret(),
          expiresIn: '15m',
          jwtid: randomUUID(),
        },
      );
      return { requiresRegistration: true, registrationToken };
    }

    return this.prisma.transaction(async (tx) => {
      const consumed = await this.patientOtpRepository.consumeIfUnused(
        otp.id,
        tx,
      );
      if (consumed.count !== 1) {
        throw new UnauthorizedException('Mã OTP đã được sử dụng');
      }

      const tokens = await this.issueTokens(
        patient.id,
        patient.tokenVersion,
        tx,
      );
      return { requiresRegistration: false, ...tokens };
    });
  }

  async completePhoneRegistration(
    dto: CompletePatientRegistrationDto,
  ): Promise<PatientTokenResponseDto> {
    let payload: PatientRegistrationTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<PatientRegistrationTokenPayload>(
        dto.registrationToken,
        { secret: this.registrationTokenSecret() },
      );
    } catch {
      throw new UnauthorizedException(
        'Phiên đăng ký đã hết hạn — vui lòng xác thực lại số điện thoại',
      );
    }

    if (payload.purpose !== REGISTRATION_TOKEN_PURPOSE || !payload.phone) {
      throw new UnauthorizedException('Mã xác nhận đăng ký không hợp lệ');
    }

    const existing = await this.patientsRepository.findByPhone(payload.phone);
    if (existing) {
      throw new ConflictException(
        'Số điện thoại đã có hồ sơ — vui lòng xác thực lại để đăng nhập',
      );
    }

    const patientType = await this.patientsRepository.findDefaultPatientType();
    if (!patientType) {
      throw new BadRequestException(
        'Chưa có loại bệnh nhân mặc định — vui lòng liên hệ quản trị viên',
      );
    }

    return this.prisma.transaction(async (tx) => {
      const patient = await this.patientsRepository.create(
        {
          phone: payload.phone,
          fullName: dto.fullName,
          gender: dto.gender,
          birthday: dto.birthday,
          email: dto.email,
          address: dto.address,
          identityNumber: dto.identityNumber,
          emergencyContact: dto.emergencyContact,
          patientType: { connect: { id: patientType.id } },
        },
        tx,
      );

      return this.issueTokens(patient.id, patient.tokenVersion, tx);
    });
  }

  // ── ĐĂNG KÝ (REGISTER) ──────────────────────────────────────────────

  async requestRegisterOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const existing = await this.patientsRepository.findByPhone(dto.phone);
    if (existing) {
      throw new ConflictException(
        'Số điện thoại đã được đăng ký — vui lòng đăng nhập',
      );
    }

    await this.assertResendCooldown(dto.phone, OtpPurpose.REGISTER);
    await this.createAndSendOtp(dto.phone, OtpPurpose.REGISTER, null);

    return { message: 'Đã gửi mã OTP đăng ký' };
  }

  /**
   * Unit of Work: verify OTP xong, tạo Patient + đánh dấu OTP đã dùng
   * trong CÙNG 1 transaction. Nếu tạo Patient lỗi, OTP vẫn còn valid để
   * người dùng thử lại — không bị "đốt" OTP vô ích.
   */
  async verifyRegister(
    dto: VerifyRegisterDto,
  ): Promise<PatientTokenResponseDto> {
    const otp = await this.verifyOtpOrThrow(
      dto.phone,
      dto.otp,
      OtpPurpose.REGISTER,
    );

    const patientType = dto.patientTypeId
      ? await this.prisma.patientType.findUnique({
          where: { id: dto.patientTypeId },
        })
      : await this.patientsRepository.findDefaultPatientType();

    if (!patientType) {
      throw new BadRequestException(
        dto.patientTypeId
          ? 'patientTypeId không tồn tại'
          : 'Chưa có loại bệnh nhân mặc định (code "STANDARD") — Admin cần tạo trước, hoặc chạy lại prisma:seed',
      );
    }

    const patient = await this.prisma.transaction(async (tx) => {
      const consumed = await this.patientOtpRepository.consumeIfUnused(
        otp.id,
        tx,
      );
      if (consumed.count !== 1) {
        throw new UnauthorizedException('Mã OTP đã được sử dụng');
      }

      const created = await this.patientsRepository.create(
        {
          phone: dto.phone,
          fullName: dto.fullName,
          gender: dto.gender,
          birthday: dto.birthday,
          email: dto.email,
          address: dto.address,
          identityNumber: dto.identityNumber,
          emergencyContact: dto.emergencyContact,
          patientType: { connect: { id: patientType.id } },
        },
        tx,
      );

      return created;
    });

    return this.issueTokens(patient.id, patient.tokenVersion);
  }

  // ── ĐĂNG NHẬP (LOGIN) ───────────────────────────────────────────────

  async requestLoginOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const patient = await this.patientsRepository.findByPhone(dto.phone);
    if (!patient) {
      throw new NotFoundException(
        'Số điện thoại chưa đăng ký — vui lòng đăng ký tài khoản trước',
      );
    }

    await this.assertResendCooldown(dto.phone, OtpPurpose.LOGIN);
    await this.createAndSendOtp(dto.phone, OtpPurpose.LOGIN, patient.id);

    return { message: 'Đã gửi mã OTP đăng nhập' };
  }

  async verifyLogin(dto: VerifyLoginDto): Promise<PatientTokenResponseDto> {
    const patient = await this.patientsRepository.findByPhone(dto.phone);
    if (!patient) {
      throw new NotFoundException('Số điện thoại chưa đăng ký');
    }

    const otp = await this.verifyOtpOrThrow(dto.phone, dto.otp, OtpPurpose.LOGIN);

    return this.prisma.transaction(async (tx) => {
      const consumed = await this.patientOtpRepository.consumeIfUnused(
        otp.id,
        tx,
      );
      if (consumed.count !== 1) {
        throw new UnauthorizedException('Mã OTP đã được sử dụng');
      }

      return this.issueTokens(patient.id, patient.tokenVersion, tx);
    });
  }

  // ── REFRESH / LOGOUT ────────────────────────────────────────────────

  async refresh(
    dto: PatientRefreshTokenDto,
  ): Promise<PatientTokenResponseDto> {
    let payload: PatientJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<PatientJwtPayload>(
        dto.refreshToken,
        { secret: this.configService.get<string>('jwt.patientRefreshSecret') },
      );
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    return this.prisma.transaction(async (tx) => {
      const tokenHash = hashToken(dto.refreshToken);
      const patient = await this.patientsRepository.findById(payload.sub, tx);
      if (!patient) {
        throw new NotFoundException('Tài khoản không còn tồn tại');
      }
      if ((payload.tokenVersion ?? 0) !== patient.tokenVersion) {
        throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
      }

      const consumed = await this.patientSessionRepository.consumeValid(
        payload.sub,
        tokenHash,
        tx,
      );
      if (consumed.count < 1) {
        throw new UnauthorizedException(
          'Refresh token đã bị thu hồi hoặc đã được sử dụng',
        );
      }

      return this.issueTokens(patient.id, patient.tokenVersion, tx);
    });
  }

  async logout(patientId: string): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      await this.patientSessionRepository.revokeAllForPatient(patientId, tx);
      await this.patientsRepository.incrementTokenVersion(patientId, tx);
    });
  }

  // ── HELPERS ─────────────────────────────────────────────────────────

  private async assertResendCooldown(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const latest = await this.patientOtpRepository.findLatest(phone, purpose);
    if (!latest) return;

    const cooldownSeconds = this.configService.get<number>(
      'otp.resendCooldownSeconds',
    )!;
    const elapsedSeconds = (Date.now() - latest.createdAt.getTime()) / 1000;

    if (elapsedSeconds < cooldownSeconds) {
      const waitSeconds = Math.ceil(cooldownSeconds - elapsedSeconds);
      throw new BadRequestException(
        `Vui lòng đợi ${waitSeconds}s trước khi yêu cầu gửi lại OTP`,
      );
    }
  }

  private async createAndSendOtp(
    phone: string,
    purpose: OtpPurpose,
    patientId: string | null,
  ): Promise<void> {
    const length = this.configService.get<number>('otp.length')!;
    const expiresInSeconds = this.configService.get<number>(
      'otp.expiresInSeconds',
    )!;
    const maxAttempts = this.configService.get<number>('otp.maxAttempts')!;

    const code = generateOtpCode(length);
    const codeHash = await bcrypt.hash(code, OTP_SALT_ROUNDS);

    await this.patientOtpRepository.create({
      phone,
      codeHash,
      purpose,
      maxAttempts,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      ...(patientId ? { patient: { connect: { id: patientId } } } : {}),
    });

    await this.otpSender.sendOtp(phone, code);
  }

  private async simulateOtpHashWork(): Promise<void> {
    const length = this.configService.get<number>('otp.length')!;
    await bcrypt.hash(generateOtpCode(length), OTP_SALT_ROUNDS);
  }

  private async verifyOtpOrThrow(
    phone: string,
    code: string,
    purpose: OtpPurpose,
  ) {
    const otp = await this.patientOtpRepository.findValidForVerify(
      phone,
      purpose,
    );
    if (!otp) {
      throw new UnauthorizedException(
        'Không tìm thấy OTP hợp lệ — mã đã hết hạn hoặc chưa từng được gửi',
      );
    }

    if (otp.attempts >= otp.maxAttempts) {
      throw new UnauthorizedException(
        'Đã vượt quá số lần thử OTP cho phép — vui lòng yêu cầu gửi lại mã mới',
      );
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      await this.patientOtpRepository.incrementAttemptsIfAllowed(
        otp.id,
        otp.maxAttempts,
      );
      throw new UnauthorizedException('Mã OTP không đúng');
    }

    return otp;
  }

  private async issueTokens(
    patientId: string,
    tokenVersion: number,
    db?: Prisma.TransactionClient,
  ): Promise<PatientTokenResponseDto> {
    const payload: PatientJwtPayload = { sub: patientId, tokenVersion };

    const accessExpiresIn = this.configService.get<string>(
      'jwt.patientAccessExpiresIn',
    )!;
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.patientRefreshExpiresIn',
    )!;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.patientAccessSecret'),
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.patientRefreshSecret'),
        expiresIn: refreshExpiresIn,
        jwtid: randomUUID(),
      }),
    ]);

    await this.patientSessionRepository.create(
      {
        patient: { connect: { id: patientId } },
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: this.computeExpiryDate(refreshExpiresIn),
      },
      db,
    );

    return { accessToken, refreshToken };
  }

  private computeExpiryDate(expiresIn: string): Date {
    const match = /^(\d+)(s|m|h|d)$/.exec(expiresIn);
    const now = Date.now();

    if (!match) {
      return new Date(now + 30 * 24 * 60 * 60 * 1000); // fallback an toàn: 30 ngày
    }

    const value = parseInt(match[1], 10);
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    return new Date(now + value * unitMs[match[2]]);
  }

  private registrationTokenSecret(): string {
    return `${this.configService.get<string>('jwt.patientAccessSecret')}:registration`;
  }
}
