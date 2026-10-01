import { Injectable } from '@nestjs/common';
import { Prisma, SimulationRun, SimulationRunStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

/** Hình dạng của SimulationRun.fixtureIds — các fixture KHÔNG có quan hệ FK
 * trực tiếp tới SimulationRun (xem ghi chú trong schema.prisma). Patient/Visit
 * tổng hợp thì dùng simulationRunId + cascade delete, không cần liệt kê ở đây. */
export interface SimulationFixtureIds {
  doctorUserIds: string[];
  doctorAssignmentIds: number[];
  deviceIds: string[];
}

export const EMPTY_FIXTURE_IDS: SimulationFixtureIds = {
  doctorUserIds: [],
  doctorAssignmentIds: [],
  deviceIds: [],
};

@Injectable()
export class SimulationRunsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.SimulationRunCreateInput,
    db: Db = this.prisma,
  ): Promise<SimulationRun> {
    return db.simulationRun.create({ data });
  }

  findById(id: string, db: Db = this.prisma): Promise<SimulationRun | null> {
    return db.simulationRun.findUnique({ where: { id } });
  }

  findAll(db: Db = this.prisma): Promise<SimulationRun[]> {
    return db.simulationRun.findMany({ orderBy: { createdAt: 'desc' } });
  }

  updateStatus(
    id: string,
    status: SimulationRunStatus,
    extra: {
      startedAt?: Date;
      finishedAt?: Date;
      simEndTimeMs?: number;
      summary?: Prisma.InputJsonValue;
    } = {},
    db: Db = this.prisma,
  ): Promise<SimulationRun> {
    return db.simulationRun.update({ where: { id }, data: { status, ...extra } });
  }

  /** Ghi lại id của các fixture không có FK trực tiếp (doctor User, Device,
   * DoctorAssignment) — dùng ở teardown để xoá đúng, không phải quét toàn bộ bảng. */
  updateFixtureIds(
    id: string,
    fixtureIds: SimulationFixtureIds,
    db: Db = this.prisma,
  ): Promise<SimulationRun> {
    return db.simulationRun.update({
      where: { id },
      data: { fixtureIds: fixtureIds as unknown as Prisma.InputJsonValue },
    });
  }

  /** Xoá hẳn bản ghi SimulationRun. CHỈ gọi SAU KHI fixtures đã được dọn thủ
   * công theo đúng thứ tự (xem SimulationFixturesService.teardownRun) — xem
   * ghi chú trong service về lý do không dựa vào cascade FK cho việc này. */
  delete(id: string, db: Db = this.prisma): Promise<SimulationRun> {
    return db.simulationRun.delete({ where: { id } });
  }
}