import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PatientTypesRepository } from './patient-types.repository';
import { PatientTypesMapper } from './patient-types.mapper';
import { CreatePatientTypeDto } from './dto/create-patient-type.dto';
import { UpdatePatientTypeDto } from './dto/update-patient-type.dto';
import { PatientTypeResponseDto } from './dto/patient-type-response.dto';

@Injectable()
export class PatientTypesService {
  constructor(private readonly patientTypesRepository: PatientTypesRepository) {}

  async create(dto: CreatePatientTypeDto): Promise<PatientTypeResponseDto> {
    const existing = await this.patientTypesRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(`Code "${dto.code}" đã tồn tại`);
    }
    const created = await this.patientTypesRepository.create(dto);
    return PatientTypesMapper.toResponseDto(created);
  }

  async findAll(): Promise<PatientTypeResponseDto[]> {
    const items = await this.patientTypesRepository.findAll();
    return PatientTypesMapper.toResponseDtoList(items);
  }

  async findById(id: number): Promise<PatientTypeResponseDto> {
    const item = await this.findOrThrow(id);
    return PatientTypesMapper.toResponseDto(item);
  }

  async update(id: number, dto: UpdatePatientTypeDto): Promise<PatientTypeResponseDto> {
    await this.findOrThrow(id);

    if (dto.code) {
      const existing = await this.patientTypesRepository.findByCode(dto.code);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Code "${dto.code}" đã tồn tại`);
      }
    }

    const updated = await this.patientTypesRepository.update(id, dto);
    return PatientTypesMapper.toResponseDto(updated);
  }

  async remove(id: number): Promise<void> {
    await this.findOrThrow(id);
    await this.patientTypesRepository.softDelete(id);
  }

  private async findOrThrow(id: number) {
    const item = await this.patientTypesRepository.findById(id);
    if (!item) {
      throw new NotFoundException(`PatientType #${id} không tồn tại`);
    }
    return item;
  }
}
