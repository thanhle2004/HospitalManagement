import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Unit of Work: chạy nhiều thao tác trên nhiều repository trong CÙNG 1 transaction.
   * Nếu bất kỳ bước nào throw, toàn bộ transaction rollback.
   *
   * Dùng: this.prisma.transaction((tx) => {
   *   const user = await this.usersRepository.create(data, tx);
   *   await tx.post.create({ data: { ...post, authorId: user.id } });
   *   return user;
   * });
   */
  transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(fn);
  }
}
