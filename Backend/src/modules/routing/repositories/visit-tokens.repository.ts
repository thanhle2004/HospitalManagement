import { Injectable } from '@nestjs/common';
import { Prisma, VisitToken } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class VisitTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.VisitTokenCreateInput,
    db: Db = this.prisma,
  ): Promise<VisitToken> {
    return db.visitToken.create({ data });
  }

  /** Dùng ở Phase 7 (Check-in) để tra token quét được từ QR */
  findByToken(token: string, db: Db = this.prisma): Promise<VisitToken | null> {
    return db.visitToken.findUnique({ where: { token } });
  }

  markUsed(id: string, db: Db = this.prisma): Promise<VisitToken> {
    return db.visitToken.update({ where: { id }, data: { usedAt: new Date() } });
  }
}
