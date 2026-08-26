import { DoctorAssignmentWithRelations } from './repositories/doctor-assignments.repository';
import { DoctorAssignmentResponseDto } from './dto/doctor-assignment-response.dto';

export class DoctorAssignmentsMapper {
  static toResponseDto(
    assignment: DoctorAssignmentWithRelations,
  ): DoctorAssignmentResponseDto {
    return {
      id: assignment.id,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      doctor: {
        id: assignment.doctor.id,
        email: assignment.doctor.email,
        fullName: assignment.doctor.profile?.fullName ?? null,
      },
      room: {
        id: assignment.room.id,
        roomNumber: assignment.room.roomNumber,
        name: assignment.room.name,
      },
    };
  }

  static toResponseDtoList(
    assignments: DoctorAssignmentWithRelations[],
  ): DoctorAssignmentResponseDto[] {
    return assignments.map((a) => this.toResponseDto(a));
  }
}
