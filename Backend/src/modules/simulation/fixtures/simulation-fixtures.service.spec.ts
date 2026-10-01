import { NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus, DeviceType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PatientTypesRepository } from '../../patient-types/patient-types.repository';
import { PatientsRepository } from '../../patients/patients.repository';
import { VisitsRepository } from '../../visits/repositories/visits.repository';
import { UsersRepository } from '../../users/users.repository';
import { DoctorAssignmentsRepository } from '../../doctor-assignments/repositories/doctor-assignments.repository';
import { RoomsRepository } from '../../rooms/rooms.repository';
import { DevicesRepository } from '../../devices/devices.repository';
import {
  EMPTY_FIXTURE_IDS,
  SimulationRunsRepository,
} from '../repositories/simulation-runs.repository';
import { SimulationFixturesService } from './simulation-fixtures.service';

/** Đại diện cho Prisma.TransactionClient trong test — service không đọc gì
 * từ nó, chỉ chuyển tiếp xuống các repository (đã mock) làm tham số `db`. */
const TX = { __marker: 'tx' } as never;

function buildService(overrides: {
  patientTypesRepository?: Partial<PatientTypesRepository>;
  patientsRepository?: Partial<PatientsRepository>;
  visitsRepository?: Partial<VisitsRepository>;
  usersRepository?: Partial<UsersRepository>;
  doctorAssignmentsRepository?: Partial<DoctorAssignmentsRepository>;
  roomsRepository?: Partial<RoomsRepository>;
  devicesRepository?: Partial<DevicesRepository>;
  simulationRunsRepository?: Partial<SimulationRunsRepository>;
  prisma?: Partial<PrismaService>;
} = {}) {
  const prisma = overrides.prisma ?? {
    transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(TX)),
  };

  const patientTypesRepository = {
    findByCode: jest.fn().mockResolvedValue({ id: 99, code: 'SIMULATION' }),
    create: jest.fn(),
    ...overrides.patientTypesRepository,
  };
  const patientsRepository = {
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    findAllBySimulationRun: jest.fn().mockResolvedValue([]),
    deleteManyBySimulationRun: jest.fn().mockResolvedValue({ count: 0 }),
    ...overrides.patientsRepository,
  };
  const visitsRepository = {
    deleteManyBySimulationRun: jest.fn().mockResolvedValue({ count: 0 }),
    ...overrides.visitsRepository,
  };
  const usersRepository = {
    createStaff: jest.fn().mockResolvedValue({ id: 'doctor-1' }),
    createProfile: jest.fn().mockResolvedValue({}),
    deleteManyByIds: jest.fn().mockResolvedValue({ count: 0 }),
    ...overrides.usersRepository,
  };
  const doctorAssignmentsRepository = {
    create: jest.fn().mockResolvedValue({ id: 501 }),
    ...overrides.doctorAssignmentsRepository,
  };
  const roomsRepository = {
    findById: jest.fn().mockResolvedValue({ id: 4, roomNumber: 'P.204' }),
    ...overrides.roomsRepository,
  };
  const devicesRepository = {
    create: jest.fn().mockResolvedValue({ id: 'device-1' }),
    deleteManyByIds: jest.fn().mockResolvedValue({ count: 0 }),
    ...overrides.devicesRepository,
  };
  const simulationRunsRepository = {
    findById: jest.fn(),
    updateFixtureIds: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    ...overrides.simulationRunsRepository,
  };

  const service = new SimulationFixturesService(
    patientTypesRepository as unknown as PatientTypesRepository,
    patientsRepository as unknown as PatientsRepository,
    visitsRepository as unknown as VisitsRepository,
    usersRepository as unknown as UsersRepository,
    doctorAssignmentsRepository as unknown as DoctorAssignmentsRepository,
    roomsRepository as unknown as RoomsRepository,
    devicesRepository as unknown as DevicesRepository,
    simulationRunsRepository as unknown as SimulationRunsRepository,
    prisma as unknown as PrismaService,
  );

  return {
    service,
    prisma,
    patientTypesRepository,
    patientsRepository,
    visitsRepository,
    usersRepository,
    doctorAssignmentsRepository,
    roomsRepository,
    devicesRepository,
    simulationRunsRepository,
  };
}

describe('SimulationFixturesService characterization', () => {
  describe('ensureSimulationPatientType', () => {
    it('returns the existing PatientType id without creating a duplicate', async () => {
      const { service, patientTypesRepository } = buildService({
        patientTypesRepository: {
          findByCode: jest.fn().mockResolvedValue({ id: 7, code: 'SIMULATION' }),
        },
      });

      const id = await service.ensureSimulationPatientType();

      expect(id).toBe(7);
      expect(patientTypesRepository.create).not.toHaveBeenCalled();
    });

    it('creates the PatientType on first use', async () => {
      const { service, patientTypesRepository } = buildService({
        patientTypesRepository: {
          findByCode: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 11, code: 'SIMULATION' }),
        },
      });

      const id = await service.ensureSimulationPatientType();

      expect(id).toBe(11);
      expect(patientTypesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SIMULATION' }),
      );
    });
  });

  describe('provisionFixtures', () => {
    it('bulk-creates patients, then re-reads them to recover generated ids', async () => {
      const createdRows = [
        { id: 'p-1', phone: 'SIM-abcd1234-P0001', fullName: 'Bệnh nhân mô phỏng P0001' },
        { id: 'p-2', phone: 'SIM-abcd1234-P0002', fullName: 'Bệnh nhân mô phỏng P0002' },
      ];
      const { service, patientsRepository } = buildService({
        patientsRepository: {
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
          findAllBySimulationRun: jest.fn().mockResolvedValue(createdRows),
        },
      });

      const result = await service.provisionFixtures('run-1', {
        patientCount: 2,
        rooms: [],
      });

      expect(patientsRepository.createMany).toHaveBeenCalledWith(
        [
          expect.objectContaining({ patientTypeId: 99, simulationRunId: 'run-1' }),
          expect.objectContaining({ patientTypeId: 99, simulationRunId: 'run-1' }),
        ],
        TX,
      );
      expect(result.patients).toHaveLength(2);
      expect(result.patientTypeId).toBe(99);
    });

    it('provisions a doctor (User + profile + confirmed DoctorAssignment) and a QR device per room', async () => {
      const { service, usersRepository, doctorAssignmentsRepository, devicesRepository } =
        buildService();

      const result = await service.provisionFixtures('run-1', {
        patientCount: 0,
        rooms: [{ roomId: 4 }],
      });

      expect(usersRepository.createStaff).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.DOCTOR, status: UserStatus.ACTIVE }),
        TX,
      );
      expect(usersRepository.createProfile).toHaveBeenCalledWith(
        expect.objectContaining({ user: { connect: { id: 'doctor-1' } } }),
        TX,
      );
      // roomConfirmedAt PHẢI được set — assertDoctorOnDutyAtRoom() trong
      // DoctorService kiểm tra field này, thiếu thì mọi startExam()/
      // completeExam() cho bác sĩ mô phỏng sẽ bị từ chối với ForbiddenException.
      expect(doctorAssignmentsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          doctor: { connect: { id: 'doctor-1' } },
          room: { connect: { id: 4 } },
          roomConfirmedAt: expect.any(Date),
        }),
        TX,
      );
      expect(devicesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: DeviceType.QR_SCANNER }),
        TX,
      );
      expect(result.rooms).toEqual([
        { roomId: 4, doctorUserId: 'doctor-1', doctorAssignmentId: 501, deviceId: 'device-1' },
      ]);
    });

    it('skips doctor/device provisioning when a room opts out', async () => {
      const { service, usersRepository, devicesRepository } = buildService();

      const result = await service.provisionFixtures('run-1', {
        patientCount: 0,
        rooms: [{ roomId: 4, withDoctor: false, withDevice: false }],
      });

      expect(usersRepository.createStaff).not.toHaveBeenCalled();
      expect(devicesRepository.create).not.toHaveBeenCalled();
      expect(result.rooms).toEqual([
        { roomId: 4, doctorUserId: null, doctorAssignmentId: null, deviceId: null },
      ]);
    });

    it('records every non-relational fixture id on the run for teardown', async () => {
      const { service, simulationRunsRepository } = buildService();

      await service.provisionFixtures('run-1', {
        patientCount: 0,
        rooms: [{ roomId: 4 }],
      });

      expect(simulationRunsRepository.updateFixtureIds).toHaveBeenCalledWith(
        'run-1',
        {
          doctorUserIds: ['doctor-1'],
          doctorAssignmentIds: [501],
          deviceIds: ['device-1'],
        },
        TX,
      );
    });

    it('throws NotFoundException and provisions nothing else for an unknown room', async () => {
      const { service, usersRepository } = buildService({
        roomsRepository: { findById: jest.fn().mockResolvedValue(null) },
      });

      await expect(
        service.provisionFixtures('run-1', { patientCount: 0, rooms: [{ roomId: 999 }] }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(usersRepository.createStaff).not.toHaveBeenCalled();
    });
  });

  describe('teardownRun', () => {
    it('deletes visits before patients — Visit.patientId defaults to RESTRICT, so the reverse order would fail under real FKs', async () => {
      const callOrder: string[] = [];
      const { service } = buildService({
        simulationRunsRepository: {
          findById: jest.fn().mockResolvedValue({
            id: 'run-1',
            fixtureIds: { doctorUserIds: [], doctorAssignmentIds: [], deviceIds: [] },
          }),
        },
        visitsRepository: {
          deleteManyBySimulationRun: jest.fn().mockImplementation(async () => {
            callOrder.push('visits');
            return { count: 3 };
          }),
        },
        patientsRepository: {
          deleteManyBySimulationRun: jest.fn().mockImplementation(async () => {
            callOrder.push('patients');
            return { count: 2 };
          }),
          createMany: jest.fn(),
          findAllBySimulationRun: jest.fn(),
        },
      });

      const result = await service.teardownRun('run-1');

      expect(callOrder).toEqual(['visits', 'patients']);
      expect(result).toEqual({
        deletedVisits: 3,
        deletedPatients: 2,
        deletedDoctors: 0,
        deletedDevices: 0,
      });
    });

    it('deletes doctor Users and Devices by the ids recorded on the run, and clears fixtureIds', async () => {
      const { service, usersRepository, devicesRepository, simulationRunsRepository } =
        buildService({
          simulationRunsRepository: {
            findById: jest.fn().mockResolvedValue({
              id: 'run-1',
              fixtureIds: {
                doctorUserIds: ['doctor-1', 'doctor-2'],
                doctorAssignmentIds: [501, 502],
                deviceIds: ['device-1'],
              },
            }),
          },
          usersRepository: { deleteManyByIds: jest.fn().mockResolvedValue({ count: 2 }) },
          devicesRepository: { deleteManyByIds: jest.fn().mockResolvedValue({ count: 1 }) },
        });

      const result = await service.teardownRun('run-1');

      expect(usersRepository.deleteManyByIds).toHaveBeenCalledWith(
        ['doctor-1', 'doctor-2'],
        TX,
      );
      expect(devicesRepository.deleteManyByIds).toHaveBeenCalledWith(['device-1'], TX);
      expect(simulationRunsRepository.updateFixtureIds).toHaveBeenCalledWith(
        'run-1',
        EMPTY_FIXTURE_IDS,
        TX,
      );
      expect(result.deletedDoctors).toBe(2);
      expect(result.deletedDevices).toBe(1);
    });

    it('tolerates a run with no fixtureIds yet (provisioning failed before any fixture was recorded)', async () => {
      const { service, usersRepository, devicesRepository } = buildService({
        simulationRunsRepository: {
          findById: jest.fn().mockResolvedValue({ id: 'run-1', fixtureIds: null }),
        },
      });

      await expect(service.teardownRun('run-1')).resolves.toBeDefined();
      expect(usersRepository.deleteManyByIds).toHaveBeenCalledWith([], TX);
      expect(devicesRepository.deleteManyByIds).toHaveBeenCalledWith([], TX);
    });

    it('throws NotFoundException for an unknown run', async () => {
      const { service } = buildService({
        simulationRunsRepository: { findById: jest.fn().mockResolvedValue(null) },
      });

      await expect(service.teardownRun('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([
      ['COMPLETED', 'normal completion'],
      ['FAILED', 'failed run'],
      ['STOPPED', 'manual stop'],
    ])('releases shared room runtime state after a %s (%s)', async (_status, _description) => {
      const tx = {
        visitStep: {
          findMany: jest.fn().mockResolvedValue([
            { id: 701, assignments: [{ id: 801 }] },
            { id: 702, assignments: [{ id: 802 }] },
          ]),
        },
        roomQueueEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        roomRuntime: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        simulationRoomLease: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        routingQueue: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        visit: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        patient: { findMany: jest.fn().mockResolvedValue([{ id: 'patient-1' }]), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        doctorAssignment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      const { service } = buildService({
        prisma: {
          transaction: jest.fn((fn: (client: unknown) => unknown) => fn(tx)),
        } as unknown as PrismaService,
        simulationRunsRepository: {
          findById: jest.fn().mockResolvedValue({
            id: 'run-1',
            fixtureIds: { doctorUserIds: [], doctorAssignmentIds: [], deviceIds: [] },
          }),
        },
      });

      await service.teardownRun('run-1');

      expect(tx.simulationRoomLease.deleteMany).toHaveBeenCalledWith({
        where: { runId: 'run-1' },
      });
      expect(tx.roomQueueEntry.deleteMany).toHaveBeenCalledWith({
        where: { visitAssignmentId: { in: [801, 802] } },
      });
      expect(tx.roomRuntime.updateMany).toHaveBeenCalledWith({
        where: { currentVisitAssignmentId: { in: [801, 802] } },
        data: { currentVisitAssignmentId: null },
      });
      expect(tx.routingQueue.deleteMany).toHaveBeenCalledWith({
        where: { visitStepId: { in: [701, 702] } },
      });
      expect(tx.visit.deleteMany).toHaveBeenCalled();
    });

    it('does not delete an unlinked Visit that cannot be safely identified as simulation data', async () => {
      const tx = {
        visitStep: { findMany: jest.fn().mockResolvedValue([]) },
        roomQueueEntry: { deleteMany: jest.fn() },
        roomRuntime: { updateMany: jest.fn() },
        simulationRoomLease: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        routingQueue: { deleteMany: jest.fn() },
        visit: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        patient: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        doctorAssignment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      const { service } = buildService({
        prisma: {
          transaction: jest.fn((fn: (client: unknown) => unknown) => fn(tx)),
        } as unknown as PrismaService,
        simulationRunsRepository: {
          findById: jest.fn().mockResolvedValue({ id: 'run-1', fixtureIds: null }),
        },
      });

      await service.teardownRun('run-1');

      expect(tx.visitStep.findMany).toHaveBeenCalledWith({
        where: { visit: { OR: [{ simulationRunId: 'run-1' }] } },
        select: { id: true, assignments: { select: { id: true } } },
      });
      expect(tx.roomQueueEntry.deleteMany).not.toHaveBeenCalled();
      expect(tx.roomRuntime.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('teardownAndDeleteRun', () => {
    it('tears down fixtures and then deletes the run row itself', async () => {
      const callOrder: string[] = [];
      const { service, simulationRunsRepository } = buildService({
        simulationRunsRepository: {
          findById: jest.fn().mockResolvedValue({
            id: 'run-1',
            fixtureIds: EMPTY_FIXTURE_IDS,
          }),
          delete: jest.fn().mockImplementation(async () => {
            callOrder.push('delete-run');
            return {};
          }),
          updateFixtureIds: jest.fn().mockImplementation(async () => {
            callOrder.push('teardown-fixtures');
            return {};
          }),
        },
      });

      await service.teardownAndDeleteRun('run-1');

      expect(callOrder).toEqual(['teardown-fixtures', 'delete-run']);
      expect(simulationRunsRepository.delete).toHaveBeenCalledWith('run-1');
    });
  });
});
