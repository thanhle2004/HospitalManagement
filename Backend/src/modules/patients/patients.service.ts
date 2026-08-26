import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientsRepository } from './patients.repository';
import { PatientsMapper } from './patients.mapper';
import { PatientResponseDto } from './dto/patient-response.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly patientsRepository: PatientsRepository) {}

  async findById(id: string): Promise<PatientResponseDto> {
    const patient = await this.patientsRepository.findById(id);
    if (!patient) {
      throw new NotFoundException(`Patient #${id} không tồn tại`);
    }
    return PatientsMapper.toResponseDto(patient);
  }
}
