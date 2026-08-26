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

  findValid(
    patientId: string,
    refreshTokenHash: string,
    db: Db = this.prisma,
  ): Promise<PatientSession | null> {
    return db.patientSession.findFirst({
      where: {
        patientId,
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  revoke(id: string, db: Db = this.prisma): Promise<PatientSession> {
    return db.patientSession.update({
      where: { id },
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
