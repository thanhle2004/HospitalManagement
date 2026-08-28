import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import type { AppOptions } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';

const FIREBASE_APP_NAME = 'hospital-management-phone-auth';

@Injectable()
export class FirebasePhoneAuthService {
  private auth: Auth | null = null;

  constructor(private readonly configService: ConfigService) {}

  async verifyPhoneNumber(idToken: string): Promise<string> {
    let decodedToken;
    try {
      decodedToken = await this.getAuth().verifyIdToken(idToken, true);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new UnauthorizedException(
        'Phiên xác thực Firebase không hợp lệ hoặc đã hết hạn',
      );
    }

    if (
      decodedToken.firebase?.sign_in_provider !== 'phone' ||
      !decodedToken.phone_number
    ) {
      throw new UnauthorizedException(
        'Firebase token không được xác thực bằng số điện thoại',
      );
    }

    return this.normalizeVietnamPhone(decodedToken.phone_number);
  }

  private getAuth(): Auth {
    if (this.auth) return this.auth;

    const projectId = this.configService.get<string>('firebase.projectId');
    if (!projectId) {
      throw new ServiceUnavailableException(
        'Firebase Phone Authentication chưa được cấu hình',
      );
    }

    const existing = getApps().find((app) => app.name === FIREBASE_APP_NAME);
    const app = existing ?? initializeApp(this.appOptions(projectId), FIREBASE_APP_NAME);
    this.auth = getAuth(app);
    return this.auth;
  }

  private appOptions(projectId: string): AppOptions {
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKey = this.configService.get<string>('firebase.privateKey');

    return {
      projectId,
      credential:
        clientEmail && privateKey
          ? cert({ projectId, clientEmail, privateKey })
          : applicationDefault(),
    };
  }

  private normalizeVietnamPhone(phone: string): string {
    if (/^\+84[35789]\d{8}$/.test(phone)) return `0${phone.slice(3)}`;
    throw new UnauthorizedException(
      'Firebase chưa xác thực một số điện thoại di động Việt Nam hợp lệ',
    );
  }
}
