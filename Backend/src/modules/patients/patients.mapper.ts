import { PatientWithType } from './patients.repository';
import { PatientResponseDto } from './dto/patient-response.dto';

export class PatientsMapper {
  static toResponseDto(patient: PatientWithType): PatientResponseDto {
    return {
      id: patient.id,
      phone: patient.phone,
      fullName: patient.fullName,
      gender: patient.gender,
      birthday: patient.birthday,
      email: patient.email,
      address: patient.address,
      identityNumber: patient.identityNumber,
      emergencyContact: patient.emergencyContact,
      patientType: {
        id: patient.patientType.id,
        code: patient.patientType.code,
        name: patient.patientType.name,
      },
      createdAt: patient.createdAt,
    };
  }
}
