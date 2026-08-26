import {
  PrismaClient,
  UserRole,
  RoomStatus,
  VisitStatus,
  VisitStepStatus,
  AssignmentStatus,
  QueueEntrySource,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────
// Helper — mỗi hàm idempotent (chạy lại nhiều lần không tạo trùng), TRỪ
// phần "Visit demo" ở cuối — xem ghi chú cleanup trước khi tạo.
// ─────────────────────────────────────────────────────────────────────────

async function seedAdmin() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@hospital.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      profile: { create: { fullName: 'System Admin' } },
    },
  });

  console.log('✅ Admin:', admin.email, `(mật khẩu: ${adminPassword})`);
  return admin;
}

async function seedDefaultPatientType() {
  const patientType = await prisma.patientType.upsert({
    where: { code: 'STANDARD' },
    update: {},
    create: {
      code: 'STANDARD',
      name: 'Bệnh nhân thường',
      description: 'Loại bệnh nhân mặc định, gán tự động khi không chọn loại cụ thể',
    },
  });
  console.log('✅ PatientType:', patientType.code);
  return patientType;
}

async function seedDoctor(email: string, fullName: string) {
  const passwordHash = await bcrypt.hash('Doctor123!', 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      role: UserRole.DOCTOR,
      profile: { create: { fullName } },
    },
  });
}

async function seedRoomType(name: string, avgProcessTime: number) {
  // RoomType.name không unique trong schema — tự check tồn tại trước khi tạo
  const existing = await prisma.roomType.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.roomType.create({ data: { name, avgProcessTime } });
}

async function seedRoom(
  roomNumber: string,
  name: string,
  roomTypeId: number,
  status: RoomStatus,
) {
  const room = await prisma.room.upsert({
    where: { roomNumber },
    update: { status, roomTypeId },
    create: { roomNumber, name, roomTypeId, status },
  });
  // RoomsService.create() thật sự sẽ tự tạo RoomRuntime kèm theo — seed cũng
  // phải làm vậy để phòng dùng được ngay cho luồng "start exam" thật.
  await prisma.roomRuntime.upsert({
    where: { roomId: room.id },
    update: {},
    create: { roomId: room.id },
  });
  return room;
}

async function seedPatient(phone: string, fullName: string, patientTypeId: number) {
  return prisma.patient.upsert({
    where: { phone },
    update: {},
    create: { phone, fullName, patientTypeId },
  });
}

async function main() {
  await seedAdmin();
  const patientType = await seedDefaultPatientType();

  console.log('\n--- Dữ liệu demo cho Dashboard ---');

  const doctorA = await seedDoctor('bs.a@hospital.local', 'BS. Nguyễn Văn A');
  const doctorB = await seedDoctor('bs.b@hospital.local', 'BS. Trần Thị B');
  console.log('✅ Doctor:', doctorA.email, '/', doctorB.email, '(mật khẩu: Doctor123!)');

  const roomTypeInternal = await seedRoomType('Khám Nội', 15);
  const roomTypeEye = await seedRoomType('Khám Mắt', 10);

  // P102 CỐ TÌNH không gán bác sĩ trực — dùng để test cảnh báo trên Dashboard
  const roomP101 = await seedRoom('P101', 'Phòng Nội 1', roomTypeInternal.id, RoomStatus.ACTIVE);
  const roomP102 = await seedRoom('P102', 'Phòng Nội 2', roomTypeInternal.id, RoomStatus.ACTIVE);
  const roomP103 = await seedRoom('P103', 'Phòng Mắt 1', roomTypeEye.id, RoomStatus.ACTIVE);
  await seedRoom('P104', 'Phòng Mắt 2 (bảo trì)', roomTypeEye.id, RoomStatus.MAINTENANCE);
  console.log('✅ Room: P101, P102 (không bác sĩ trực), P103 = ACTIVE · P104 = MAINTENANCE');

  const flow = await prisma.flow.upsert({
    where: { code: 'GENERAL_CHECKUP' },
    update: {},
    create: { code: 'GENERAL_CHECKUP', name: 'Khám tổng quát' },
  });
  const flowStep = await prisma.flowStep.upsert({
    where: { flowId_code: { flowId: flow.id, code: 'INTERNAL' } },
    update: {},
    create: {
      flowId: flow.id,
      code: 'INTERNAL',
      roomTypeId: roomTypeInternal.id,
      displayOrder: 1,
      isOptional: false,
    },
  });
  console.log('✅ Flow:', flow.name);

  const patient1 = await seedPatient('0901111111', 'Lê Văn Một', patientType.id);
  const patient2 = await seedPatient('0902222222', 'Phạm Thị Hai', patientType.id);
  const patient3 = await seedPatient('0903333333', 'Hoàng Văn Ba', patientType.id);

  // ── CLEANUP: seed chạy lại nhiều lần sẽ cộng dồn Visit demo nếu không dọn
  // trước — xoá sạch dữ liệu demo cũ của đúng 3 patient này để số liệu luôn
  // khớp với log in ra ở cuối, dù chạy `npm run prisma:seed` bao nhiêu lần.
  // Phải gỡ RoomRuntime.currentVisitAssignmentId TRƯỚC khi xoá Visit, nếu
  // không MySQL sẽ chặn xoá vì còn FK trỏ tới (quan hệ đó không có onDelete
  // Cascade, mặc định Restrict).
  await prisma.roomRuntime.updateMany({
    where: { roomId: { in: [roomP101.id, roomP102.id, roomP103.id] } },
    data: { currentVisitAssignmentId: null },
  });
  await prisma.visit.deleteMany({
    where: { patientId: { in: [patient1.id, patient2.id, patient3.id] } },
  });
  await prisma.doctorAssignment.deleteMany({
    where: { doctorId: { in: [doctorA.id, doctorB.id] }, endTime: null },
  });

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  await prisma.doctorAssignment.create({
    data: { doctorId: doctorA.id, roomId: roomP101.id, startTime: oneHourAgo, endTime: null },
  });
  await prisma.doctorAssignment.create({
    data: { doctorId: doctorB.id, roomId: roomP103.id, startTime: oneHourAgo, endTime: null },
  });
  console.log('✅ Ca trực: BS A → P101, BS B → P103 (P102 bỏ trống để test cảnh báo)');

  // Visit 1 — ĐANG ĐƯỢC KHÁM (VisitAssignment.status = IN_PROGRESS tại P101)
  const visit1 = await prisma.visit.create({
    data: {
      patientId: patient1.id,
      flowId: flow.id,
      status: VisitStatus.WAITING,
      startedAt: new Date(now.getTime() - 20 * 60 * 1000),
    },
  });
  const step1 = await prisma.visitStep.create({
    data: {
      visitId: visit1.id,
      flowStepId: flowStep.id,
      roomTypeId: roomTypeInternal.id,
      displayOrder: 1,
      isOptional: false,
      status: VisitStepStatus.IN_PROGRESS, // đồng bộ với assignment bên dưới (§7 invariant)
    },
  });
  const assignment1 = await prisma.visitAssignment.create({
    data: {
      visitStepId: step1.id,
      roomId: roomP101.id,
      doctorId: doctorA.id,
      status: AssignmentStatus.IN_PROGRESS,
      checkedInAt: new Date(now.getTime() - 15 * 60 * 1000),
      startedAt: new Date(now.getTime() - 10 * 60 * 1000),
    },
  });
  await prisma.roomQueueEntry.create({
    data: {
      roomId: roomP101.id,
      visitAssignmentId: assignment1.id,
      position: 1,
      source: QueueEntrySource.AUTO_CHECKIN,
    },
  });
  await prisma.roomRuntime.update({
    where: { roomId: roomP101.id },
    data: { currentVisitAssignmentId: assignment1.id },
  });

  // Visit 2 — ĐÃ CHECK-IN, CHƯA bắt đầu khám tại P103 (test: không được tính vào "Đang được khám")
  const visit2 = await prisma.visit.create({
    data: {
      patientId: patient2.id,
      flowId: flow.id,
      status: VisitStatus.WAITING,
      startedAt: new Date(now.getTime() - 8 * 60 * 1000),
    },
  });
  const step2 = await prisma.visitStep.create({
    data: {
      visitId: visit2.id,
      flowStepId: flowStep.id,
      roomTypeId: roomTypeEye.id,
      displayOrder: 1,
      isOptional: false,
      status: VisitStepStatus.CHECKED_IN,
    },
  });
  const assignment2 = await prisma.visitAssignment.create({
    data: {
      visitStepId: step2.id,
      roomId: roomP103.id,
      status: AssignmentStatus.CHECKED_IN,
      checkedInAt: new Date(now.getTime() - 5 * 60 * 1000),
    },
  });
  await prisma.roomQueueEntry.create({
    data: {
      roomId: roomP103.id,
      visitAssignmentId: assignment2.id,
      position: 1,
      source: QueueEntrySource.AUTO_CHECKIN,
    },
  });

  // Visit 3 — ĐÃ HOÀN THÀNH hôm nay (test: "khám hôm nay" đếm cả case đã xong, không chỉ đang chờ/đang khám)
  const visit3 = await prisma.visit.create({
    data: {
      patientId: patient3.id,
      flowId: flow.id,
      status: VisitStatus.COMPLETED,
      startedAt: new Date(now.getTime() - 90 * 60 * 1000),
      completedAt: new Date(now.getTime() - 60 * 60 * 1000),
    },
  });
  const step3 = await prisma.visitStep.create({
    data: {
      visitId: visit3.id,
      flowStepId: flowStep.id,
      roomTypeId: roomTypeInternal.id,
      displayOrder: 1,
      isOptional: false,
      status: VisitStepStatus.COMPLETED,
      completedAt: new Date(now.getTime() - 60 * 60 * 1000),
    },
  });
  await prisma.visitAssignment.create({
    data: {
      visitStepId: step3.id,
      roomId: roomP101.id,
      doctorId: doctorA.id,
      status: AssignmentStatus.COMPLETED,
      checkedInAt: new Date(now.getTime() - 85 * 60 * 1000),
      startedAt: new Date(now.getTime() - 80 * 60 * 1000),
      completedAt: new Date(now.getTime() - 60 * 60 * 1000),
    },
  });
  // Không tạo RoomQueueEntry cho visit3 — khớp đúng hành vi thật:
  // DoctorService.completeExam() đã dequeue lúc hoàn thành khám.

  console.log('✅ Visit: 3 lượt hôm nay (1 đang khám, 1 đang chờ, 1 đã hoàn thành)');

  console.log('\n📊 Dashboard PHẢI hiển thị đúng:');
  console.log('   • Bệnh nhân khám hôm nay : 3');
  console.log('   • Đang được khám         : 1');
  console.log('   • Phòng đang hoạt động   : 3   (P101, P102, P103 — P104 đang MAINTENANCE)');
  console.log('   • Bác sĩ đang trực       : 2   (BS A tại P101, BS B tại P103)');
  console.log('   • Cảnh báo               : "P102" ACTIVE nhưng không có bác sĩ trực');
  console.log('\nℹ️  Chạy lại `npm run prisma:seed` bao nhiêu lần cũng ra đúng 5 số liệu trên (đã tự dọn dữ liệu demo cũ).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
