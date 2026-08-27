import { Injectable } from '@nestjs/common';
import { PatientSession, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PatientSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.PatientSessionCreateInput,
    db: Db = this.prisma,
  ): Promise<PatientSession> {
    return db.patientSession.create({ data });
  }

  consumeValid(
    patientId: string,
    refreshTokenHash: string,
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    return db.patientSession.updateMany({
      where: {
        patientId,
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForPatient(
    patientId: string,
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    return db.patientSession.updateMany({
      where: { patientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
