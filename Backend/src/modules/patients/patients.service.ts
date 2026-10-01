import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientsRepository } from './patients.repository';
import { PatientsMapper } from './patients.mapper';
import { PatientResponseDto } from './dto/patient-response.dto';
import { FindAdminPatientsQueryDto } from './dto/find-admin-patients-query.dto';
import { PaginatedPatientResponseDto } from './dto/paginated-patient-response.dto';
import { UpdatePatientTypeDto } from './dto/update-patient-type.dto';
import { PatientTypesRepository } from '../patient-types/patient-types.repository';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuditAction } from '../activity-log/audit-action.catalog';
import { PrismaService } from '../../prisma/prisma.service';

export interface PatientAuditContext { requestId?: string; ipAddress?: string; userAgent?: string }

@Injectable()
export class PatientsService {
  constructor(
    private readonly patientsRepository: PatientsRepository,
    private readonly patientTypesRepository: PatientTypesRepository,
    private readonly activityLogService: ActivityLogService,
    private readonly prisma: PrismaService,
  ) {}

  async findById(id: string): Promise<PatientResponseDto> {
    const patient = await this.patientsRepository.findById(id);
    if (!patient) {
      throw new NotFoundException(`Patient #${id} không tồn tại`);
    }
    return PatientsMapper.toResponseDto(patient);
  }

  async findAllForAdmin(
    query: FindAdminPatientsQueryDto,
  ): Promise<PaginatedPatientResponseDto> {
    const filter = {
      search: query.search,
      patientTypeId: query.patientTypeId,
    };
    const skip = (query.page - 1) * query.limit;
    const [patients, total] = await Promise.all([
      this.patientsRepository.findAllForAdmin(filter, skip, query.limit),
      this.patientsRepository.countForAdmin(filter),
    ]);

    return {
      items: patients.map((patient) => PatientsMapper.toResponseDto(patient)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async updatePatientType(
    id: string,
    dto: UpdatePatientTypeDto,
    adminUserId: string,
    context: PatientAuditContext = {},
  ): Promise<PatientResponseDto> {
    const patient = await this.patientsRepository.findById(id);
    if (!patient) {
      throw new NotFoundException(`Patient #${id} không tồn tại`);
    }

    const patientType = await this.patientTypesRepository.findById(
      dto.patientTypeId,
    );
    if (!patientType) {
      throw new NotFoundException(
        `PatientType #${dto.patientTypeId} không tồn tại`,
      );
    }

    if (patient.patientTypeId === dto.patientTypeId) {
      return PatientsMapper.toResponseDto(patient);
    }

    const updated = await this.prisma.transaction(async (tx) => {
      const saved = await this.patientsRepository.updatePatientType(id, dto.patientTypeId, tx);
      await this.activityLogService.log({
        userId: adminUserId,
        action: AuditAction.PATIENT_TYPE_UPDATED,
        entity: 'Patient',
        entityId: id,
        metadata: { requestId: context.requestId, previousPatientTypeId: patient.patientTypeId, patientTypeId: dto.patientTypeId },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }, tx);
      return saved;
    });
    return PatientsMapper.toResponseDto(updated);
  }
}
