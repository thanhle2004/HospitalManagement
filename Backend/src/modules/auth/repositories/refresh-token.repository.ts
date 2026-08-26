import { Injectable } from '@nestjs/common';
import { Prisma, RefreshToken } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.RefreshTokenCreateInput,
    db: Db = this.prisma,
  ): Promise<RefreshToken> {
    return db.refreshToken.create({ data });
  }

  findValid(
    userId: string,
    tokenHash: string,
    db: Db = this.prisma,
  ): Promise<RefreshToken | null> {
    return db.refreshToken.findFirst({
      where: {
        userId,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  revoke(id: string, db: Db = this.prisma): Promise<RefreshToken> {
    return db.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForUser(userId: string, db: Db = this.prisma): Promise<Prisma.BatchPayload> {
    return db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
