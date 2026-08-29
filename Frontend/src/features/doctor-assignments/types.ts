export interface DoctorAssignment {
  id: number;
  startTime: string;
  endTime: string | null;
  roomConfirmedAt: string | null;
  doctor: { id: string; email: string; fullName: string | null };
  room: { id: number; roomNumber: string; name: string };
}

export interface CreateDoctorAssignmentPayload {
  doctorId: string;
  roomId: number;
  startTime: string;
  endTime?: string;
}
