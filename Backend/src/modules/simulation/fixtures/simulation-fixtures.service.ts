import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DeviceType, Prisma, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { PatientTypesRepository } from '../../patient-types/patient-types.repository';
import { PatientsRepository } from '../../patients/patients.repository';
import { VisitsRepository } from '../../visits/repositories/visits.repository';
import { UsersRepository } from '../../users/users.repository';
import { DoctorAssignmentsRepository } from '../../doctor-assignments/repositories/doctor-assignments.repository';
import { RoomsRepository } from '../../rooms/rooms.repository';
import { DevicesRepository } from '../../devices/devices.repository';
import { generateDeviceSecret } from '../../devices/utils/generate-device-secret.util';
import {
  EMPTY_FIXTURE_IDS,
  SimulationRunsRepository,
} from '../repositories/simulation-runs.repository';
import {
  simulationDeviceCode,
  simulationDoctorEmail,
  simulationDoctorFullName,
  simulationPatientFullName,
  simulationPatientPhone,
} from './utils/generate-simulation-identifiers.util';
import {
  ProvisionedFixtures,
  ProvisionedRoomFixture,
  ProvisionFixturesInput,
  TeardownResult,
} from './simulation-fixtures.types';

/** Code cố định cho PatientType dùng riêng cho mọi bệnh nhân tổng hợp — cho
 * phép /admin/patients và mọi báo cáo lọc bỏ dữ liệu mô phỏng bằng 1 `where`
 * (xem docs/simulator-architecture.md §3.2, lựa chọn #1). */
const SIMULATION_PATIENT_TYPE_CODE = 'SIMULATION';
const SIMULATION_PATIENT_TYPE_NAME = 'Bệnh nhân mô phỏng (Simulator)';

const SALT_ROUNDS = 10;

@Injectable()
export class SimulationFixturesService {
  private readonly logger = new Logger(SimulationFixturesService.name);

  constructor(
    private readonly patientTypesRepository: PatientTypesRepository,
    private readonly patientsRepository: PatientsRepository,
    private readonly visitsRepository: VisitsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly doctorAssignmentsRepository: DoctorAssignmentsRepository,
    private readonly roomsRepository: RoomsRepository,
    private readonly devicesRepository: DevicesRepository,
    private readonly simulationRunsRepository: SimulationRunsRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** findOrCreate — an toàn gọi nhiều lần/nhiều run song song (unique trên `code`). */
  async ensureSimulationPatientType(): Promise<number> {
    const existing = await this.patientTypesRepository.findByCode(
      SIMULATION_PATIENT_TYPE_CODE,
    );
    if (existing) return existing.id;

    try {
      const created = await this.patientTypesRepository.create({
        code: SIMULATION_PATIENT_TYPE_CODE,
        name: SIMULATION_PATIENT_TYPE_NAME,
        description:
          'Sinh tự động bởi Admin Patient Flow Simulator — không phải bệnh nhân thật.',
      });
      return created.id;
    } catch (err) {
      // Hai run khởi tạo song song lần đầu cùng lúc — @unique(code) chặn 1
      // trong 2, coi như no-op vì bên kia đã tạo xong.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const race = await this.patientTypesRepository.findByCode(
          SIMULATION_PATIENT_TYPE_CODE,
        );
        if (race) return race.id;
      }
      throw err;
    }
  }

  /**
   * Cấp phát toàn bộ fixture cho 1 SimulationRun: N Patient tổng hợp, và với
   * mỗi phòng được scenario yêu cầu — 1 User bác sĩ (+ UserProfile +
   * DoctorAssignment đã roomConfirmedAt) và/hoặc 1 Device QR_SCANNER.
  *
   * thống (xem docs/simulator-architecture.md §3.2), vì Room là dữ liệu cấu
   * hình vật lý của bệnh viện, không phải thứ mô phỏng nên tổng hợp ra.
   *
   * Toàn bộ nằm trong 1 Unit of Work — lỗi ở bất kỳ bước nào rollback sạch,
   * không để lại fixture "mồ côi" nửa vời cho 1 run thất bại.
   */
  async provisionFixtures(
    runId: string,
    input: ProvisionFixturesInput,
  ): Promise<ProvisionedFixtures> {
    const patientTypeId = await this.ensureSimulationPatientType();

    const result = await this.prisma.transaction(async (tx) => {
      const patients = await this.provisionPatients(
        runId,
        patientTypeId,
        input.patientCount,
        tx,
      );

      const rooms: ProvisionedRoomFixture[] = [];
      const doctorUserIds: string[] = [];
      const doctorAssignmentIds: number[] = [];
      const deviceIds: string[] = [];

      // Tuần tự (không Promise.all) — tránh 2 phòng cùng đụng UNIQUE trên
      // users.email/devices.code do đọc-rồi-ghi trùng thời điểm; số phòng
      // trong 1 scenario nhỏ (vài chục), không đáng lo hiệu năng.
      for (const roomInput of input.rooms) {
        const room = await this.roomsRepository.findById(roomInput.roomId, tx);
        if (!room) {
          throw new NotFoundException(`Room #${roomInput.roomId} không tồn tại`);
        }

        let doctorUserId: string | null = null;
        let doctorAssignmentId: number | null = null;
        if (roomInput.withDoctor ?? true) {
          const provisioned = await this.provisionDoctorForRoom(
            runId,
            room.id,
            doctorUserIds.length,
            tx,
          );
          doctorUserId = provisioned.userId;
          doctorAssignmentId = provisioned.assignmentId;
          doctorUserIds.push(provisioned.userId);
          doctorAssignmentIds.push(provisioned.assignmentId);
        }

        let deviceId: string | null = null;
        if (roomInput.withDevice ?? true) {
          deviceId = await this.provisionDeviceForRoom(runId, room.id, tx);
          deviceIds.push(deviceId);
        }

        rooms.push({ roomId: room.id, doctorUserId, doctorAssignmentId, deviceId });
      }

      await this.simulationRunsRepository.updateFixtureIds(
        runId,
        { doctorUserIds, doctorAssignmentIds, deviceIds },
        tx,
      );

      return { patients, rooms };
    });

    this.logger.log(
      `SimulationRun #${runId}: cấp phát ${result.patients.length} bệnh nhân, ` +
        `${result.rooms.length} phòng tổng hợp fixture`,
    );

    return { patientTypeId, ...result };
  }

  /**
   * Dọn sạch toàn bộ fixture của 1 run — Patient/Visit/User bác sĩ/Device
   * tổng hợp — nhưng GIỮ LẠI bản ghi SimulationRun (để vẫn xem được
   * config/summary/metrics sau khi dọn). Dùng cho "Reset" trên UI.
   *
   * Thứ tự xoá KHÔNG dựa vào cascade FK của SimulationRun cho Patient/Visit,
   * dù cascade đó tồn tại như lưới an toàn — lý do: Visit.patientId là quan
   * hệ bắt buộc, mặc định RESTRICT (không khai báo onDelete trong schema).
   * Nếu để InnoDB tự cascade xoá song song Patient (qua patients.simulation_
   * run_id) và Visit (qua visits.simulation_run_id) từ CÙNG 1 lệnh xoá
   * SimulationRun, thứ tự xử lý 2 cascade độc lập đó không được đảm bảo —
   * có rủi ro InnoDB thử xoá Patient trước khi Visit tham chiếu đến nó đã bị
   * xoá xong, và RESTRICT sẽ chặn giữa chừng. Xoá tường minh theo đúng thứ
   * tự (Visit trước, Patient sau) loại bỏ hoàn toàn rủi ro đó.
   *
   * User bác sĩ / Device không có FK tới SimulationRun (xem fixtureIds) nên
   * xoá theo id đã lưu; deleteMany bỏ qua id không tồn tại nên gọi lại
   * (idempotent) sau 1 lần teardown lỗi giữa chừng là an toàn.
   */
  async teardownRun(runId: string): Promise<TeardownResult> {
    const run = await this.simulationRunsRepository.findById(runId);
    if (!run) {
      throw new NotFoundException(`SimulationRun #${runId} không tồn tại`);
    }
    const fixtureIds = (run.fixtureIds as unknown as {
      doctorUserIds?: string[];
      doctorAssignmentIds?: number[];
      deviceIds?: string[];
    } | null) ?? EMPTY_FIXTURE_IDS;

    const result = await this.prisma.transaction(async (tx) => {
      // Lease is shared-room runtime state and must not survive teardown,
      // even when fixture deletion later fails and is retried.
      if ('simulationRoomLease' in tx) {
        await tx.simulationRoomLease.deleteMany({ where: { runId } });
      }
      if (!('patient' in tx)) {
        const visitsDeleted = await this.visitsRepository.deleteManyBySimulationRun(runId, tx);
        const patientsDeleted = await this.patientsRepository.deleteManyBySimulationRun(runId, tx);
        const doctorsDeleted = await this.usersRepository.deleteManyByIds(
          fixtureIds.doctorUserIds ?? [],
          tx,
        );
        const devicesDeleted = await this.devicesRepository.deleteManyByIds(
          fixtureIds.deviceIds ?? [],
          tx,
        );
        await this.simulationRunsRepository.updateFixtureIds(
          runId,
          EMPTY_FIXTURE_IDS,
          tx,
        );
        return {
          deletedVisits: visitsDeleted.count,
          deletedPatients: patientsDeleted.count,
          deletedDoctors: doctorsDeleted.count,
          deletedDevices: devicesDeleted.count,
        };
      }

      const patientIds = (
        await tx.patient.findMany({
          where: { simulationRunId: runId },
          select: { id: true },
        })
      ).map((patient) => patient.id);
      const visitWhere = {
        OR: [
          { simulationRunId: runId },
          ...(patientIds.length > 0 ? [{ patientId: { in: patientIds } }] : []),
        ],
      };
      const visitSteps = await tx.visitStep.findMany({
        where: { visit: visitWhere },
        select: { id: true, assignments: { select: { id: true } } },
      });
      const visitStepIds = visitSteps.map((step) => step.id);
      const assignmentIds = visitSteps.flatMap((step) =>
        step.assignments.map((assignment) => assignment.id),
      );

      // These rows are runtime state on shared physical rooms. Delete them
      // explicitly before the Visit cascade so teardown remains correct even
      // when a legacy database has incomplete cascade metadata.
      if (assignmentIds.length > 0) {
        await tx.roomQueueEntry.deleteMany({
          where: { visitAssignmentId: { in: assignmentIds } },
        });
        await tx.roomRuntime.updateMany({
          where: { currentVisitAssignmentId: { in: assignmentIds } },
          data: { currentVisitAssignmentId: null },
        });
      }
      if (visitStepIds.length > 0) {
        await tx.routingQueue.deleteMany({
          where: { visitStepId: { in: visitStepIds } },
        });
      }

      const visitsDeleted = await tx.visit.deleteMany({ where: visitWhere });
      const patientsDeleted = await tx.patient.deleteMany({
        where: { id: { in: patientIds } },
      });

      if ('doctorAssignment' in tx) {
        await tx.doctorAssignment.deleteMany({
          where: { id: { in: fixtureIds.doctorAssignmentIds ?? [] } },
        });
      }

      // DoctorAssignment.doctor có onDelete: Cascade (khai báo tường minh
      // trong schema) — xoá User bác sĩ tự dọn theo DoctorAssignment, không
      // cần xoá doctorAssignmentIds riêng.
      const doctorsDeleted = await this.usersRepository.deleteManyByIds(
        fixtureIds.doctorUserIds ?? [],
        tx,
      );
      const devicesDeleted = await this.devicesRepository.deleteManyByIds(
        fixtureIds.deviceIds ?? [],
        tx,
      );

      await this.simulationRunsRepository.updateFixtureIds(
        runId,
        EMPTY_FIXTURE_IDS,
        tx,
      );

      return {
        deletedVisits: visitsDeleted.count,
        deletedPatients: patientsDeleted.count,
        deletedDoctors: doctorsDeleted.count,
        deletedDevices: devicesDeleted.count,
      };
    });

    this.logger.log(
      `SimulationRun #${runId}: dọn xong — ${result.deletedVisits} visit, ` +
        `${result.deletedPatients} bệnh nhân, ${result.deletedDoctors} bác sĩ, ` +
        `${result.deletedDevices} thiết bị`,
    );

    return result;
  }

  /** Giống teardownRun() nhưng xoá LUÔN bản ghi SimulationRun — dùng khi
   * người dùng xoá hẳn 1 run khỏi danh sách (DELETE /admin/simulation/runs/:id). */
  async teardownAndDeleteRun(runId: string): Promise<TeardownResult> {
    const result = await this.teardownRun(runId);
    await this.simulationRunsRepository.delete(runId);
    return result;
  }

  private async provisionPatients(
    runId: string,
    patientTypeId: number,
    count: number,
    tx: Prisma.TransactionClient,
  ) {
    if (count <= 0) return [];

    const rows: Prisma.PatientCreateManyInput[] = Array.from(
      { length: count },
      (_, i) => {
        const index = i + 1;
        return {
          phone: simulationPatientPhone(runId, index),
          fullName: simulationPatientFullName(index),
          patientTypeId,
          simulationRunId: runId,
        };
      },
    );

    await this.patientsRepository.createMany(rows, tx);
    const created = await this.patientsRepository.findAllBySimulationRun(runId, tx);
    return created.map((p) => ({ id: p.id, phone: p.phone, fullName: p.fullName }));
  }

  private async provisionDoctorForRoom(
    runId: string,
    roomId: number,
    doctorIndex: number,
    tx: Prisma.TransactionClient,
  ): Promise<{ userId: string; assignmentId: number }> {
    // Bác sĩ tổng hợp không bao giờ đăng nhập thật (DoctorService được gọi
    // trực tiếp trong tiến trình, xem §4.2) — password ngẫu nhiên, không ai
    // cần biết, chỉ tồn tại vì passwordHash là NOT NULL trong schema.
    const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), SALT_ROUNDS);

    const user = await this.usersRepository.createStaff(
      {
        email: simulationDoctorEmail(runId, doctorIndex),
        passwordHash,
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
      },
      tx,
    );
    await this.usersRepository.createProfile(
      {
        user: { connect: { id: user.id } },
        fullName: simulationDoctorFullName(doctorIndex),
      },
      tx,
    );

    const now = new Date();
    const assignment = await this.doctorAssignmentsRepository.create(
      {
        doctor: { connect: { id: user.id } },
        room: { connect: { id: roomId } },
        startTime: now,
        // endTime bỏ trống = ca trực mở (tới vô hạn), giống quy ước hiện có
        // trong DoctorAssignmentsRepository.findOverlapping().
        roomConfirmedAt: now, // bắt buộc — assertDoctorOnDutyAtRoom() trong DoctorService kiểm tra field này
      },
      tx,
    );

    return { userId: user.id, assignmentId: assignment.id };
  }

  private async provisionDeviceForRoom(
    runId: string,
    roomId: number,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const secretKeyHash = await bcrypt.hash(generateDeviceSecret(), SALT_ROUNDS);

    const device = await this.devicesRepository.create(
      {
        code: simulationDeviceCode(runId, roomId),
        name: `Máy quét QR mô phỏng — phòng #${roomId}`,
        type: DeviceType.QR_SCANNER,
        secretKeyHash,
        room: { connect: { id: roomId } },
      },
      tx,
    );

    return device.id;
  }
}
