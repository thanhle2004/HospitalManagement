import { NotFoundException } from '@nestjs/common';
import { Gender } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PatientTypesRepository } from '../patient-types/patient-types.repository';
import { PatientsRepository } from './patients.repository';
import { PatientsService } from './patients.service';

const patient = {
  id: 'patient-1',
  phone: '0901111111',
  fullName: 'Bệnh nhân Test',
  gender: Gender.MALE,
  birthday: null,
  email: null,
  address: null,
  identityNumber: null,
  emergencyContact: null,
  patientTypeId: 1,
  tokenVersion: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  patientType: {
    id: 1,
    code: 'STANDARD',
    name: 'Bệnh nhân thường',
    description: null,
    deletedAt: null,
  },
};

describe('PatientsService admin operations', () => {
  it('returns a paginated, mapped patient list', async () => {
    const patientsRepository = {
      findAllForAdmin: jest.fn().mockResolvedValue([patient]),
      countForAdmin: jest.fn().mockResolvedValue(1),
    };
    const service = new PatientsService(
      patientsRepository as unknown as PatientsRepository,
      {} as PatientTypesRepository,
      {} as ActivityLogService,
    );

    const result = await service.findAllForAdmin({
      search: '0901',
      patientTypeId: 1,
      page: 2,
      limit: 10,
    });

    expect(patientsRepository.findAllForAdmin).toHaveBeenCalledWith(
      { search: '0901', patientTypeId: 1 },
      10,
      10,
    );
    expect(result).toEqual({
      items: [expect.objectContaining({ id: 'patient-1', phone: '0901111111' })],
      total: 1,
      page: 2,
      limit: 10,
    });
  });

  it('updates patient type and writes an audit log without PII', async () => {
    const updated = {
      ...patient,
      patientTypeId: 2,
      patientType: { ...patient.patientType, id: 2, code: 'PRIORITY', name: 'Ưu tiên' },
    };
    const patientsRepository = {
      findById: jest.fn().mockResolvedValue(patient),
      updatePatientType: jest.fn().mockResolvedValue(updated),
    };
    const patientTypesRepository = {
      findById: jest.fn().mockResolvedValue(updated.patientType),
    };
    const activityLogService = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new PatientsService(
      patientsRepository as unknown as PatientsRepository,
      patientTypesRepository as unknown as PatientTypesRepository,
      activityLogService as unknown as ActivityLogService,
    );

    const result = await service.updatePatientType(
      'patient-1',
      { patientTypeId: 2 },
      'admin-1',
    );

    expect(result.patientType.code).toBe('PRIORITY');
    expect(activityLogService.log).toHaveBeenCalledWith({
      userId: 'admin-1',
      action: 'PATIENT_TYPE_UPDATED',
      entity: 'Patient',
      entityId: 'patient-1',
      metadata: { previousPatientTypeId: 1, patientTypeId: 2 },
    });
  });

  it('rejects a deleted or unknown patient type', async () => {
    const patientsRepository = {
      findById: jest.fn().mockResolvedValue(patient),
      updatePatientType: jest.fn(),
    };
    const patientTypesRepository = { findById: jest.fn().mockResolvedValue(null) };
    const service = new PatientsService(
      patientsRepository as unknown as PatientsRepository,
      patientTypesRepository as unknown as PatientTypesRepository,
      { log: jest.fn() } as unknown as ActivityLogService,
    );

    await expect(
      service.updatePatientType('patient-1', { patientTypeId: 99 }, 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(patientsRepository.updatePatientType).not.toHaveBeenCalled();
  });
});
