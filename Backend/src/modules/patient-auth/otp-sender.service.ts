import { Injectable, Logger } from '@nestjs/common';

/**
 * Mock gửi SMS. Thay implementation này bằng SMS
 * gateway thật (Speed SMS, eSMS, Twilio...) khi có tài khoản/API key —
 * chỉ cần sửa 1 file này, phần còn lại của PatientAuthService không đổi.
 */
@Injectable()
export class OtpSenderService {
  private readonly logger = new Logger(OtpSenderService.name);

  async sendOtp(phone: string, code: string): Promise<void> {
    // TODO: thay bằng SMS gateway thật khi deploy
    // Không log code hoặc số điện thoại: cả hai đều là dữ liệu nhạy cảm.
    void phone;
    void code;
    this.logger.warn(
      'Mock SMS adapter accepted an OTP dispatch; secret payload omitted',
    );
  }
}
