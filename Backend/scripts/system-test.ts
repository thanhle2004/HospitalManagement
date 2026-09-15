import 'dotenv/config';

import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  data: T;
  message?: string | string[];
}

interface StaffTokens {
  accessToken: string;
  refreshToken: string;
}

interface RoomTypeResponse {
  id: number;
  name: string;
}

interface FlowResponse {
  id: number;
  code: string;
  name: string;
}

interface FlowStepResponse {
  id: number;
  code: string;
  roomTypeId: number;
}

interface VisitAssignmentSummary {
  room: { id: number; roomNumber: string; name: string };
  qrToken: string | null;
  qrExpiresAt: string | null;
}

interface VisitStepSummary {
  id: number;
  code: string | null;
  status: string;
  dependsOn: number[];
  assignment: VisitAssignmentSummary | null;
}

interface VisitDetail {
  id: string;
  patientId: string;
  status: string;
  steps: VisitStepSummary[];
}

interface DutyAssignment {
  id: number;
  roomConfirmedAt: string | null;
  room: { id: number; roomNumber: string; name: string };
}

interface DoctorQueueEntry {
  visitAssignmentId: number;
  visitStepId: number;
  status: string;
  room: { id: number; roomNumber: string };
  patient: { id: string; fullName: string };
}

interface DeviceTokenResponse {
  accessToken: string;
}

interface AdminQueueEntry {
  visitAssignmentId: number;
  visitStepId: number;
  status: string;
  room: { id: number; roomNumber: string };
  patient: { id: string; fullName: string };
}

interface SystemStepFixture {
  code: string;
  roomTypeName: string;
  expectedRoomNumber: string;
}

const prisma = new PrismaClient();
const jwtService = new JwtService();

const apiBaseUrl = (process.env.SYSTEM_TEST_API_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);
const adminEmail = process.env.SYSTEM_TEST_ADMIN_EMAIL ?? 'admin@hospital.local';
const adminPassword = process.env.SYSTEM_TEST_ADMIN_PASSWORD ?? 'ChangeMe123!';
const doctorPassword = process.env.SYSTEM_TEST_DOCTOR_PASSWORD ?? 'Doctor123!';
const scannerSecret = process.env.SYSTEM_TEST_SCANNER_SECRET ?? 'Scanner123!';

const systemSteps: SystemStepFixture[] = [
  { code: 'DERM_TEST', roomTypeName: 'Da liễu', expectedRoomNumber: 'P111' },
  { code: 'ECG_TEST', roomTypeName: 'Điện tim', expectedRoomNumber: 'CLS308' },
  { code: 'EYE_TEST', roomTypeName: 'Khám Mắt', expectedRoomNumber: 'P103' },
];

const refreshTokenHashes = new Set<string>();
const resetConfirmedAssignmentIds = new Set<number>();
let testFlowId: number | null = null;
let testPatientId: string | null = null;
let testVisitId: string | null = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function statusLine(message: string): void {
  console.log(`✓ ${message}`);
}

async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const rawBody = await response.text();
  const parsed = rawBody ? (JSON.parse(rawBody) as ApiEnvelope<T>) : null;

  if (!response.ok) {
    const message = parsed?.message
      ? Array.isArray(parsed.message)
        ? parsed.message.join('; ')
        : parsed.message
      : `HTTP ${response.status}`;
    throw new Error(`${options.method ?? 'GET'} ${path} thất bại: ${message}`);
  }

  return parsed?.data as T;
}

async function expectHttpStatus(
  path: string,
  expectedStatus: number,
  token: string,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  assert(
    response.status === expectedStatus,
    `GET ${path}: mong đợi HTTP ${expectedStatus}, nhận ${response.status}`,
  );
}

async function waitFor<T>(
  description: string,
  action: () => Promise<T | null>,
  timeoutMs = 15_000,
): Promise<T> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await action();
    if (result !== null) return result;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Hết thời gian chờ: ${description}`);
}

async function loginStaff(email: string, password: string): Promise<StaffTokens> {
  const tokens = await apiRequest<StaffTokens>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  refreshTokenHashes.add(hashToken(tokens.refreshToken));
  return tokens;
}

async function getVisit(adminToken: string): Promise<VisitDetail> {
  assert(testVisitId, 'Visit test chưa được tạo');
  return apiRequest<VisitDetail>(`/visits/${testVisitId}`, { token: adminToken });
}

async function cleanup(): Promise<void> {
  if (testVisitId) {
    const assignmentIds = (
      await prisma.visitAssignment.findMany({
        where: { visitStep: { visitId: testVisitId } },
        select: { id: true },
      })
    ).map((assignment) => assignment.id);

    if (assignmentIds.length > 0) {
      await prisma.roomRuntime.updateMany({
        where: { currentVisitAssignmentId: { in: assignmentIds } },
        data: { currentVisitAssignmentId: null },
      });
    }
    await prisma.visit.deleteMany({ where: { id: testVisitId } });
  }

  if (resetConfirmedAssignmentIds.size > 0) {
    await prisma.doctorAssignment.updateMany({
      where: { id: { in: [...resetConfirmedAssignmentIds] } },
      data: { roomConfirmedAt: null },
    });
  }

  if (testPatientId) {
    await prisma.patient.deleteMany({ where: { id: testPatientId } });
  }

  if (testFlowId) {
    await prisma.flow.deleteMany({ where: { id: testFlowId } });
  }

  if (refreshTokenHashes.size > 0) {
    await prisma.refreshToken.deleteMany({
      where: { tokenHash: { in: [...refreshTokenHashes] } },
    });
  }
}

async function run(): Promise<void> {
  const health = await apiRequest<{ status: string }>('/health/ready');
  assert(health.status === 'ok', 'Backend chưa ở trạng thái ready');
  statusLine('Backend và database sẵn sàng');

  const adminTokens = await loginStaff(adminEmail, adminPassword);
  statusLine('Admin đăng nhập thành công');

  const roomTypes = await apiRequest<RoomTypeResponse[]>('/room-types', {
    token: adminTokens.accessToken,
  });
  const roomTypeByName = new Map(roomTypes.map((roomType) => [roomType.name, roomType]));
  for (const fixture of systemSteps) {
    assert(
      roomTypeByName.has(fixture.roomTypeName),
      `Thiếu RoomType seed "${fixture.roomTypeName}"`,
    );
  }

  const uniqueSuffix = `${Date.now()}_${process.pid}`;
  const flow = await apiRequest<FlowResponse>('/flows', {
    method: 'POST',
    token: adminTokens.accessToken,
    body: {
      code: `SYSTEM_TEST_${uniqueSuffix}`,
      name: `[SYSTEM TEST] Luồng ${uniqueSuffix}`,
      description: 'Workflow tạm thời cho kiểm thử xuyên suốt; tự động dọn sau khi chạy.',
    },
  });
  testFlowId = flow.id;

  const createdSteps: FlowStepResponse[] = [];
  for (const [index, fixture] of systemSteps.entries()) {
    createdSteps.push(
      await apiRequest<FlowStepResponse>(`/flows/${flow.id}/steps`, {
        method: 'POST',
        token: adminTokens.accessToken,
        body: {
          code: fixture.code,
          roomTypeId: roomTypeByName.get(fixture.roomTypeName)!.id,
          displayOrder: index + 1,
          isOptional: false,
        },
      }),
    );
  }
  await apiRequest(`/flows/${flow.id}/dependencies`, {
    method: 'POST',
    token: adminTokens.accessToken,
    body: { stepId: createdSteps[1].id, requiredStepId: createdSteps[0].id },
  });
  await apiRequest(`/flows/${flow.id}/dependencies`, {
    method: 'POST',
    token: adminTokens.accessToken,
    body: { stepId: createdSteps[2].id, requiredStepId: createdSteps[1].id },
  });

  const cycleResponse = await fetch(`${apiBaseUrl}/flows/${flow.id}/dependencies`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminTokens.accessToken}`,
    },
    body: JSON.stringify({
      stepId: createdSteps[0].id,
      requiredStepId: createdSteps[2].id,
    }),
  });
  assert(cycleResponse.status === 409, `Chống cycle phải trả HTTP 409, nhận ${cycleResponse.status}`);
  statusLine('Admin tạo workflow DAG và hệ thống từ chối dependency tạo chu trình');

  const patientType = await prisma.patientType.findUnique({ where: { code: 'STANDARD' } });
  assert(patientType, 'Thiếu PatientType STANDARD; hãy chạy prisma:seed');
  const patient = await prisma.patient.create({
    data: {
      phone: `SYSTEM_TEST_${uniqueSuffix}`,
      fullName: `[SYSTEM TEST] Bệnh nhân ${uniqueSuffix}`,
      patientTypeId: patientType.id,
    },
  });
  testPatientId = patient.id;

  const patientAccessSecret = process.env.JWT_PATIENT_ACCESS_SECRET;
  assert(patientAccessSecret, 'Thiếu JWT_PATIENT_ACCESS_SECRET trong Backend/.env');
  const patientToken = await jwtService.signAsync(
    { sub: patient.id, tokenVersion: patient.tokenVersion },
    { secret: patientAccessSecret, expiresIn: '10m' },
  );

  const createdVisit = await apiRequest<VisitDetail>('/visits', {
    method: 'POST',
    token: patientToken,
    body: { flowId: flow.id },
  });
  testVisitId = createdVisit.id;
  assert(createdVisit.steps.length === systemSteps.length, 'Visit không copy đủ FlowStep');
  assert(
    createdVisit.steps.filter((step) => step.status !== 'LOCKED').length === 1,
    'Chỉ bước đầu tiên được phép mở khi tạo Visit',
  );
  statusLine('Bệnh nhân đăng ký dịch vụ và Visit runtime được tạo đúng DAG');

  const doctorTokensByEmail = new Map<string, StaffTokens>();
  const deviceTokensByRoom = new Map<string, string>();
  let firstDoctorToken: string | null = null;
  let firstDeviceToken: string | null = null;

  for (const [index, fixture] of systemSteps.entries()) {
    await apiRequest('/routing/process-now', {
      method: 'POST',
      token: adminTokens.accessToken,
    });

    const readyStep = await waitFor(`điều phối bước ${fixture.code}`, async () => {
      const visit = await getVisit(adminTokens.accessToken);
      const step = visit.steps.find((item) => item.code === fixture.code);
      if (step?.status === 'ASSIGNED' && step.assignment?.qrToken) return step;
      return null;
    });
    assert(
      readyStep.assignment?.room.roomNumber === fixture.expectedRoomNumber,
      `${fixture.code} phải vào ${fixture.expectedRoomNumber}, nhận ${readyStep.assignment?.room.roomNumber}`,
    );

    const roomId = readyStep.assignment.room.id;
    const duty = await prisma.doctorAssignment.findFirst({
      where: {
        roomId,
        startTime: { lte: new Date() },
        OR: [{ endTime: null }, { endTime: { gt: new Date() } }],
      },
      include: { doctor: true },
      orderBy: { startTime: 'desc' },
    });
    assert(duty, `Phòng ${fixture.expectedRoomNumber} chưa có bác sĩ trực`);

    let doctorTokens = doctorTokensByEmail.get(duty.doctor.email);
    if (!doctorTokens) {
      doctorTokens = await loginStaff(duty.doctor.email, doctorPassword);
      doctorTokensByEmail.set(duty.doctor.email, doctorTokens);
    }
    firstDoctorToken ??= doctorTokens.accessToken;

    const dutyAssignments = await apiRequest<DutyAssignment[]>('/doctor/duty-assignments', {
      token: doctorTokens.accessToken,
    });
    const dutyAssignment = dutyAssignments.find((item) => item.id === duty.id);
    assert(dutyAssignment, `Bác sĩ không đọc được ca trực #${duty.id}`);
    if (!dutyAssignment.roomConfirmedAt) {
      resetConfirmedAssignmentIds.add(dutyAssignment.id);
      await apiRequest(`/doctor/duty-assignments/${dutyAssignment.id}/confirm-room`, {
        method: 'POST',
        token: doctorTokens.accessToken,
      });
    }

    let deviceToken = deviceTokensByRoom.get(fixture.expectedRoomNumber);
    if (!deviceToken) {
      const deviceLogin = await apiRequest<DeviceTokenResponse>('/device-auth/login', {
        method: 'POST',
        body: { code: `QR-${fixture.expectedRoomNumber}`, secret: scannerSecret },
      });
      deviceToken = deviceLogin.accessToken;
      deviceTokensByRoom.set(fixture.expectedRoomNumber, deviceToken);
    }
    firstDeviceToken ??= deviceToken;

    await apiRequest('/check-in', {
      method: 'POST',
      token: deviceToken,
      body: { token: readyStep.assignment.qrToken },
    });

    const queueEntry = await waitFor(`hàng đợi bác sĩ tại ${fixture.expectedRoomNumber}`, async () => {
      const queue = await apiRequest<DoctorQueueEntry[]>('/doctor/queue', {
        token: doctorTokens!.accessToken,
      });
      return queue.find(
        (entry) => entry.visitStepId === readyStep.id && entry.patient.id === patient.id,
      ) ?? null;
    });
    assert(queueEntry.status === 'CHECKED_IN', 'Hàng đợi bác sĩ phải ở trạng thái CHECKED_IN');

    const adminQueue = await apiRequest<AdminQueueEntry[]>('/admin/queue', {
      token: adminTokens.accessToken,
    });
    assert(
      adminQueue.some((entry) => entry.visitAssignmentId === queueEntry.visitAssignmentId),
      'Admin không nhìn thấy bệnh nhân vừa check-in trong hàng đợi',
    );

    await apiRequest(`/doctor/visit-assignments/${queueEntry.visitAssignmentId}/start`, {
      method: 'POST',
      token: doctorTokens.accessToken,
    });
    await apiRequest(`/doctor/visit-assignments/${queueEntry.visitAssignmentId}/complete`, {
      method: 'POST',
      token: doctorTokens.accessToken,
    });

    const completedVisit = await waitFor(`hoàn tất bước ${fixture.code}`, async () => {
      const visit = await getVisit(adminTokens.accessToken);
      const step = visit.steps.find((item) => item.code === fixture.code);
      return step?.status === 'COMPLETED' ? visit : null;
    });
    const nextFixture = systemSteps[index + 1];
    if (nextFixture) {
      const nextStep = completedVisit.steps.find((step) => step.code === nextFixture.code);
      assert(nextStep?.status !== 'LOCKED', `${nextFixture.code} chưa được mở khóa`);
    }
    statusLine(
      `${fixture.code}: điều phối ${fixture.expectedRoomNumber} → check-in → bắt đầu → hoàn tất`,
    );
  }

  const finalVisit = await getVisit(adminTokens.accessToken);
  assert(finalVisit.status === 'COMPLETED', `Visit phải COMPLETED, nhận ${finalVisit.status}`);
  assert(
    finalVisit.steps.every((step) => step.status === 'COMPLETED'),
    'Không phải mọi bước đều COMPLETED',
  );

  const patientVisit = await apiRequest<VisitDetail>(`/visits/me/${finalVisit.id}`, {
    token: patientToken,
  });
  assert(patientVisit.patientId === patient.id, 'Patient không đọc được đúng Visit của mình');

  assert(firstDoctorToken, 'Không có Doctor token để kiểm tra phân quyền');
  assert(firstDeviceToken, 'Không có Device token để kiểm tra phân quyền');
  await expectHttpStatus('/admin/patients?page=1&limit=10', 403, firstDoctorToken);
  await expectHttpStatus('/visits', 401, patientToken);
  await expectHttpStatus('/visits', 401, firstDeviceToken);
  statusLine('Phân quyền Admin/Doctor/Patient/Device được tách đúng');
  statusLine('Toàn bộ Visit hoàn tất và Patient xem được kết quả của chính mình');
}

async function main(): Promise<void> {
  console.log('\n=== HospitalManagement system flow test ===\n');
  try {
    await run();
    console.log('\n✅ LUỒNG KIỂM THỬ HỆ THỐNG THÀNH CÔNG\n');
  } catch (error) {
    console.error(
      `\n❌ LUỒNG KIỂM THỬ THẤT BẠI: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  } finally {
    try {
      await cleanup();
      statusLine('Đã dọn dữ liệu tạm của system test');
    } catch (cleanupError) {
      console.error(
        `Không dọn được toàn bộ dữ liệu test: ${
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        }`,
      );
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  }
}

void main();
