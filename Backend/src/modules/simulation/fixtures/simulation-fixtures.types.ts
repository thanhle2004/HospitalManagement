/** 1 phòng tham gia scenario cần bác sĩ và/hoặc thiết bị QR tổng hợp. */
export interface ProvisionRoomFixtureInput {
  roomId: number;
  /** Mặc định true — hầu hết scenario cần bác sĩ trực để DoctorSimulator gọi startExam/completeExam. */
  withDoctor?: boolean;
  /** Mặc định true — cần để PatientGenerator gọi CheckInService.checkIn() như bệnh nhân thật. */
  withDevice?: boolean;
}

export interface ProvisionFixturesInput {
  patientCount: number;
  rooms: ProvisionRoomFixtureInput[];
}

export interface ProvisionedPatientFixture {
  id: string;
  phone: string;
  fullName: string;
}

export interface ProvisionedRoomFixture {
  roomId: number;
  doctorUserId: string | null;
  doctorAssignmentId: number | null;
  deviceId: string | null;
}

export interface ProvisionedFixtures {
  patientTypeId: number;
  patients: ProvisionedPatientFixture[];
  rooms: ProvisionedRoomFixture[];
}

export interface TeardownResult {
  deletedVisits: number;
  deletedPatients: number;
  deletedDoctors: number;
  deletedDevices: number;
}