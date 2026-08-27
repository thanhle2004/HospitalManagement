import { Injectable } from '@nestjs/common';
import { OtpPurpose, PatientOtp, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PatientOtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.PatientOtpCreateInput,
    db: Db = this.prisma,
  ): Promise<PatientOtp> {
    return db.patientOtp.create({ data });
  }

  /** OTP mới nhất (dùng để check cooldown resend), bất kể còn hạn hay đã dùng */
  findLatest(
    phone: string,
    purpose: OtpPurpose,
    db: Db = this.prisma,
  ): Promise<PatientOtp | null> {
    return db.patientOtp.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** OTP còn hiệu lực để verify: chưa dùng, chưa hết hạn */
  findValidForVerify(
    phone: string,
    purpose: OtpPurpose,
    db: Db = this.prisma,
  ): Promise<PatientOtp | null> {
    return db.patientOtp.findFirst({
      where: {
        phone,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  incrementAttemptsIfAllowed(
    id: string,
    maxAttempts: number,
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    return db.patientOtp.updateMany({
      where: { id, usedAt: null, attempts: { lt: maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
  }

  consumeIfUnused(
    id: string,
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    return db.patientOtp.updateMany({
      where: { id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
  }

  linkToPatient(
    id: string,
    patientId: string,
    db: Db = this.prisma,
  ): Promise<PatientOtp> {
    return db.patientOtp.update({ where: { id }, data: { patientId } });
  }
}
