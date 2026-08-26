import { PatientType } from '@prisma/client';
import { PatientTypeResponseDto } from './dto/patient-type-response.dto';

export class PatientTypesMapper {
  static toResponseDto(patientType: PatientType): PatientTypeResponseDto {
    return {
      id: patientType.id,
      code: patientType.code,
      name: patientType.name,
      description: patientType.description,
    };
  }

  static toResponseDtoList(items: PatientType[]): PatientTypeResponseDto[] {
    return items.map((i) => this.toResponseDto(i));
  }
}
