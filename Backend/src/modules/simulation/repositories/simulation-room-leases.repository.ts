import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

class RoomLeaseConflict extends Error {
  constructor(readonly conflicts: Array<{ roomId: number; runId: string }>) {
    super('SIMULATION_ROOM_LEASE_CONFLICT');
  }
}

/** Database-backed, cross-process lease for shared physical room state. */
@Injectable()
export class SimulationRoomLeasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquire(runId: string, roomIds: readonly number[]): Promise<void> {
    const uniqueRoomIds = Array.from(new Set(roomIds)).sort((a, b) => a - b);
    if (uniqueRoomIds.length === 0) return;

    try {
      await this.prisma.transaction(async (tx) => {
        await tx.simulationRoomLease.createMany({
          data: uniqueRoomIds.map((roomId) => ({ roomId, runId })),
          skipDuplicates: true,
        });
        const leases = await tx.simulationRoomLease.findMany({
          where: { roomId: { in: uniqueRoomIds } },
          select: { roomId: true, runId: true },
        });
        const conflicts = leases.filter((lease) => lease.runId !== runId);
        if (conflicts.length > 0 || leases.length !== uniqueRoomIds.length) {
          throw new RoomLeaseConflict(conflicts);
        }
      });
    } catch (error) {
      if (error instanceof RoomLeaseConflict) {
        const details = error.conflicts
          .map((lease) => `phòng #${lease.roomId} (run #${lease.runId})`)
          .join(', ');
        throw new ConflictException(
          `Không thể bắt đầu simulation: physical room đang được lease${details ? `: ${details}` : ''}`,
        );
      }
      throw error;
    }
  }

  async releaseByRun(runId: string, db: Db = this.prisma): Promise<number> {
    const result = await db.simulationRoomLease.deleteMany({ where: { runId } });
    return result.count;
  }
}
