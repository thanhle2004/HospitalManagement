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

  console.log('✅ Admin demo account created (credentials omitted from logs)');
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
  if (existing) {
    return prisma.roomType.update({
      where: { id: existing.id },
      data: { avgProcessTime, deletedAt: null },
    });
  }
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

interface ClinicServiceStepSeed {
  code: string;
  roomTypeId: number;
  displayOrder: number;
  isOptional?: boolean;
  /** Mã các bước phải hoàn tất trước bước hiện tại. */
  dependsOn?: string[];
}

interface ClinicServiceSeed {
  code: string;
  name: string;
  description: string;
  steps: ClinicServiceStepSeed[];
}

function assertValidClinicServiceSeed(service: ClinicServiceSeed): void {
  const stepCodes = new Set(service.steps.map((step) => step.code));
  if (stepCodes.size !== service.steps.length) {
    throw new Error(`Flow ${service.code} có mã bước bị trùng`);
  }

  const inDegree = new Map(service.steps.map((step) => [step.code, 0]));
  const nextSteps = new Map(service.steps.map((step) => [step.code, [] as string[]]));

  for (const step of service.steps) {
    for (const requiredCode of step.dependsOn ?? []) {
      if (!stepCodes.has(requiredCode)) {
        throw new Error(
          `Flow ${service.code}: bước ${step.code} phụ thuộc bước không tồn tại ${requiredCode}`,
        );
      }
      if (requiredCode === step.code) {
        throw new Error(`Flow ${service.code}: bước ${step.code} tự phụ thuộc chính nó`);
      }
      nextSteps.get(requiredCode)!.push(step.code);
      inDegree.set(step.code, inDegree.get(step.code)! + 1);
    }
  }

  const ready = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([code]) => code);
  let visited = 0;

  while (ready.length > 0) {
    const current = ready.shift()!;
    visited += 1;
    for (const next of nextSteps.get(current) ?? []) {
      const remaining = inDegree.get(next)! - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) ready.push(next);
    }
  }

  if (visited !== service.steps.length) {
    throw new Error(`Flow ${service.code} chứa dependency tạo chu trình`);
  }
}

async function seedClinicService(service: ClinicServiceSeed) {
  assertValidClinicServiceSeed(service);

  const flow = await prisma.flow.upsert({
    where: { code: service.code },
    update: {
      name: service.name,
      description: service.description,
      deletedAt: null,
    },
    create: {
      code: service.code,
      name: service.name,
      description: service.description,
    },
  });

  const stepsByCode = new Map<string, Awaited<ReturnType<typeof prisma.flowStep.upsert>>>();
  for (const step of service.steps) {
    const seededStep = await prisma.flowStep.upsert({
      where: { flowId_code: { flowId: flow.id, code: step.code } },
      update: {
        roomTypeId: step.roomTypeId,
        displayOrder: step.displayOrder,
        isOptional: step.isOptional ?? false,
      },
      create: {
        flowId: flow.id,
        code: step.code,
        roomTypeId: step.roomTypeId,
        displayOrder: step.displayOrder,
        isOptional: step.isOptional ?? false,
      },
    });
    stepsByCode.set(step.code, seededStep);
  }

  const fixtureStepCodes = service.steps.map((step) => step.code);
  const obsoleteSteps = await prisma.flowStep.findMany({
    where: {
      flowId: flow.id,
      code: { notIn: fixtureStepCodes },
    },
    include: { _count: { select: { visitSteps: true } } },
  });
  const referencedObsoleteSteps = obsoleteSteps.filter((step) => step._count.visitSteps > 0);
  if (referencedObsoleteSteps.length > 0) {
    const details = referencedObsoleteSteps
      .map((step) => `${step.code} (${step._count.visitSteps} lượt khám)`)
      .join(', ');
    throw new Error(
      `Không thể đồng bộ Flow ${service.code}: bước ngoài fixture đang được tham chiếu: ${details}`,
    );
  }
  if (obsoleteSteps.length > 0) {
    await prisma.flowStep.deleteMany({
      where: { id: { in: obsoleteSteps.map((step) => step.id) } },
    });
  }

  // Dựng lại dependency của các bước fixture để chạy seed nhiều lần vẫn cho
  // cùng một đồ thị. Bước ngoài fixture chỉ được dọn khi không có VisitStep
  // tham chiếu; nếu có, seed dừng ở trên để không âm thầm phá dữ liệu.
  const seededStepIds = [...stepsByCode.values()].map((step) => step.id);
  await prisma.flowDependency.deleteMany({
    where: { stepId: { in: seededStepIds } },
  });

  const dependencies = service.steps.flatMap((step) =>
    (step.dependsOn ?? []).map((requiredCode) => ({
      stepId: stepsByCode.get(step.code)!.id,
      requiredStepId: stepsByCode.get(requiredCode)!.id,
    })),
  );
  if (dependencies.length > 0) {
    await prisma.flowDependency.createMany({ data: dependencies, skipDuplicates: true });
  }

  return {
    flow,
    stepsByCode,
    dependencyCount: dependencies.length,
    prunedStepCount: obsoleteSteps.length,
  };
}

async function seedClinicServices(roomTypes: {
  vitalSigns: number;
  internal: number;
  surgery: number;
  eye: number;
  ent: number;
  dental: number;
  dermatology: number;
  obstetrics: number;
  pediatrics: number;
  cardiology: number;
  laboratory: number;
  imaging: number;
  ultrasound: number;
  ecg: number;
  conclusion: number;
}) {
  const services: ClinicServiceSeed[] = [
    {
      code: 'GENERAL_CHECKUP',
      name: 'Khám tổng quát',
      description:
        'Các chuyên khoa độc lập, bệnh nhân có thể khám theo bất kỳ thứ tự nào.',
      steps: [
        { code: 'INTERNAL', roomTypeId: roomTypes.internal, displayOrder: 1 },
        { code: 'EYE', roomTypeId: roomTypes.eye, displayOrder: 2 },
        { code: 'ENT', roomTypeId: roomTypes.ent, displayOrder: 3 },
        { code: 'DENTAL', roomTypeId: roomTypes.dental, displayOrder: 4 },
        {
          code: 'DERMATOLOGY',
          roomTypeId: roomTypes.dermatology,
          displayOrder: 5,
          isOptional: true,
        },
      ],
    },
    {
      code: 'PERIODIC_HEALTH_CHECK',
      name: 'Khám sức khỏe định kỳ',
      description:
        'Các phòng khám và cận lâm sàng độc lập, có thể thực hiện song song hoặc đổi thứ tự.',
      steps: [
        { code: 'VITALS', roomTypeId: roomTypes.vitalSigns, displayOrder: 1 },
        { code: 'INTERNAL', roomTypeId: roomTypes.internal, displayOrder: 2 },
        { code: 'EYE', roomTypeId: roomTypes.eye, displayOrder: 3 },
        { code: 'DENTAL', roomTypeId: roomTypes.dental, displayOrder: 4 },
        { code: 'LAB', roomTypeId: roomTypes.laboratory, displayOrder: 5 },
        { code: 'IMAGING', roomTypeId: roomTypes.imaging, displayOrder: 6 },
      ],
    },
    {
      code: 'CARDIOVASCULAR_SCREENING',
      name: 'Tầm soát tim mạch',
      description:
        'Đo sinh hiệu trước; điện tim, xét nghiệm và siêu âm có thể làm song song trước khi khám tim mạch.',
      steps: [
        { code: 'VITALS', roomTypeId: roomTypes.vitalSigns, displayOrder: 1 },
        {
          code: 'ECG',
          roomTypeId: roomTypes.ecg,
          displayOrder: 2,
          dependsOn: ['VITALS'],
        },
        {
          code: 'LAB',
          roomTypeId: roomTypes.laboratory,
          displayOrder: 3,
          dependsOn: ['VITALS'],
        },
        {
          code: 'ULTRASOUND',
          roomTypeId: roomTypes.ultrasound,
          displayOrder: 4,
          dependsOn: ['VITALS'],
        },
        {
          code: 'CARDIOLOGY',
          roomTypeId: roomTypes.cardiology,
          displayOrder: 5,
          dependsOn: ['ECG', 'LAB', 'ULTRASOUND'],
        },
      ],
    },
    {
      code: 'DIABETES_SCREENING',
      name: 'Tầm soát đái tháo đường',
      description: 'Đo sinh hiệu → xét nghiệm → bác sĩ Nội đánh giá kết quả.',
      steps: [
        { code: 'VITALS', roomTypeId: roomTypes.vitalSigns, displayOrder: 1 },
        {
          code: 'LAB',
          roomTypeId: roomTypes.laboratory,
          displayOrder: 2,
          dependsOn: ['VITALS'],
        },
        {
          code: 'INTERNAL_REVIEW',
          roomTypeId: roomTypes.internal,
          displayOrder: 3,
          dependsOn: ['LAB'],
        },
      ],
    },
    {
      code: 'MATERNITY_CHECKUP',
      name: 'Khám thai định kỳ',
      description:
        'Sau đo sinh hiệu, siêu âm và xét nghiệm có thể làm theo bất kỳ thứ tự nào; bác sĩ Sản khám sau cùng.',
      steps: [
        { code: 'VITALS', roomTypeId: roomTypes.vitalSigns, displayOrder: 1 },
        {
          code: 'ULTRASOUND',
          roomTypeId: roomTypes.ultrasound,
          displayOrder: 2,
          dependsOn: ['VITALS'],
        },
        {
          code: 'LAB',
          roomTypeId: roomTypes.laboratory,
          displayOrder: 3,
          dependsOn: ['VITALS'],
        },
        {
          code: 'OBSTETRICS',
          roomTypeId: roomTypes.obstetrics,
          displayOrder: 4,
          dependsOn: ['ULTRASOUND', 'LAB'],
        },
      ],
    },
    {
      code: 'PREOPERATIVE_ASSESSMENT',
      name: 'Khám tiền phẫu',
      description:
        'Xét nghiệm, chẩn đoán hình ảnh và điện tim được mở sau đo sinh hiệu; Ngoại khoa đánh giá khi đủ kết quả.',
      steps: [
        { code: 'VITALS', roomTypeId: roomTypes.vitalSigns, displayOrder: 1 },
        {
          code: 'LAB',
          roomTypeId: roomTypes.laboratory,
          displayOrder: 2,
          dependsOn: ['VITALS'],
        },
        {
          code: 'IMAGING',
          roomTypeId: roomTypes.imaging,
          displayOrder: 3,
          dependsOn: ['VITALS'],
        },
        {
          code: 'ECG',
          roomTypeId: roomTypes.ecg,
          displayOrder: 4,
          dependsOn: ['VITALS'],
        },
        {
          code: 'SURGERY_REVIEW',
          roomTypeId: roomTypes.surgery,
          displayOrder: 5,
          dependsOn: ['LAB', 'IMAGING', 'ECG'],
        },
      ],
    },
    {
      code: 'PEDIATRIC_CHECKUP',
      name: 'Khám Nhi chuyên sâu',
      description: 'Đo sinh hiệu → khám Nhi → xét nghiệm → bác sĩ Nhi đọc kết quả.',
      steps: [
        { code: 'VITALS', roomTypeId: roomTypes.vitalSigns, displayOrder: 1 },
        {
          code: 'PEDIATRICS',
          roomTypeId: roomTypes.pediatrics,
          displayOrder: 2,
          dependsOn: ['VITALS'],
        },
        {
          code: 'LAB',
          roomTypeId: roomTypes.laboratory,
          displayOrder: 3,
          dependsOn: ['PEDIATRICS'],
        },
        {
          code: 'PEDIATRIC_REVIEW',
          roomTypeId: roomTypes.pediatrics,
          displayOrder: 4,
          dependsOn: ['LAB'],
        },
      ],
    },
    {
      code: 'EYE_SURGERY_ASSESSMENT',
      name: 'Đánh giá phẫu thuật mắt',
      description: 'Đo sinh hiệu → khám Mắt → xét nghiệm → bác sĩ Ngoại đánh giá phẫu thuật.',
      steps: [
        { code: 'VITALS', roomTypeId: roomTypes.vitalSigns, displayOrder: 1 },
        {
          code: 'EYE_EXAM',
          roomTypeId: roomTypes.eye,
          displayOrder: 2,
          dependsOn: ['VITALS'],
        },
        {
          code: 'LAB',
          roomTypeId: roomTypes.laboratory,
          displayOrder: 3,
          dependsOn: ['EYE_EXAM'],
        },
        {
          code: 'SURGERY_CONSULT',
          roomTypeId: roomTypes.surgery,
          displayOrder: 4,
          dependsOn: ['LAB'],
        },
      ],
    },
    {
      code: 'ENT_DIAGNOSTIC',
      name: 'Chẩn đoán Tai Mũi Họng',
      description:
        'Đo sinh hiệu → khám Tai Mũi Họng → chẩn đoán hình ảnh → tái khám đọc kết quả.',
      steps: [
        { code: 'VITALS', roomTypeId: roomTypes.vitalSigns, displayOrder: 1 },
        {
          code: 'ENT_EXAM',
          roomTypeId: roomTypes.ent,
          displayOrder: 2,
          dependsOn: ['VITALS'],
        },
        {
          code: 'IMAGING',
          roomTypeId: roomTypes.imaging,
          displayOrder: 3,
          dependsOn: ['ENT_EXAM'],
        },
        {
          code: 'ENT_REVIEW',
          roomTypeId: roomTypes.ent,
          displayOrder: 4,
          dependsOn: ['IMAGING'],
        },
      ],
    },
    {
      code: 'EXECUTIVE_HEALTH_PACKAGE',
      name: 'Gói khám sức khỏe chuyên sâu',
      description:
        'Sau đo sinh hiệu, các chuyên khoa và cận lâm sàng chạy song song; phòng Kết luận chỉ mở khi đủ kết quả.',
      steps: [
        { code: 'VITALS', roomTypeId: roomTypes.vitalSigns, displayOrder: 1 },
        {
          code: 'INTERNAL',
          roomTypeId: roomTypes.internal,
          displayOrder: 2,
          dependsOn: ['VITALS'],
        },
        {
          code: 'EYE',
          roomTypeId: roomTypes.eye,
          displayOrder: 3,
          dependsOn: ['VITALS'],
        },
        {
          code: 'CARDIOLOGY',
          roomTypeId: roomTypes.cardiology,
          displayOrder: 4,
          dependsOn: ['VITALS'],
        },
        {
          code: 'LAB',
          roomTypeId: roomTypes.laboratory,
          displayOrder: 5,
          dependsOn: ['VITALS'],
        },
        {
          code: 'ULTRASOUND',
          roomTypeId: roomTypes.ultrasound,
          displayOrder: 6,
          dependsOn: ['VITALS'],
        },
        {
          code: 'CONCLUSION',
          roomTypeId: roomTypes.conclusion,
          displayOrder: 7,
          dependsOn: ['INTERNAL', 'EYE', 'CARDIOLOGY', 'LAB', 'ULTRASOUND'],
        },
      ],
    },
  ];

  const seeded = new Map<string, Awaited<ReturnType<typeof seedClinicService>>>();
  for (const service of services) {
    const result = await seedClinicService(service);
    seeded.set(service.code, result);
    console.log(
      `✅ Dịch vụ: ${service.name} (${service.steps.length} bước, ${result.dependencyCount} ràng buộc${result.prunedStepCount > 0 ? `, dọn ${result.prunedStepCount} bước thừa` : ''})`,
    );
  }

  return seeded;
}

async function main() {
  await seedAdmin();
  const patientType = await seedDefaultPatientType();

  console.log('\n--- Dữ liệu demo cho Dashboard ---');

  const doctorA = await seedDoctor('bs.a@hospital.local', 'BS. Nguyễn Văn A');
  const doctorB = await seedDoctor('bs.b@hospital.local', 'BS. Trần Thị B');
  console.log('✅ Doctor demo accounts created (credentials omitted from logs)');

  const roomTypeVitalSigns = await seedRoomType('Tiếp nhận & Đo sinh hiệu', 8);
  const roomTypeInternal = await seedRoomType('Khám Nội', 15);
  const roomTypeSurgery = await seedRoomType('Khám Ngoại', 15);
  const roomTypeEye = await seedRoomType('Khám Mắt', 10);
  const roomTypeEnt = await seedRoomType('Tai Mũi Họng', 12);
  const roomTypeDental = await seedRoomType('Răng Hàm Mặt', 20);
  const roomTypeDermatology = await seedRoomType('Da liễu', 12);
  const roomTypeObstetrics = await seedRoomType('Sản phụ khoa', 20);
  const roomTypePediatrics = await seedRoomType('Nhi khoa', 15);
  const roomTypeCardiology = await seedRoomType('Tim mạch', 20);
  const roomTypeLaboratory = await seedRoomType('Xét nghiệm', 25);
  const roomTypeImaging = await seedRoomType('Chẩn đoán hình ảnh', 20);
  const roomTypeUltrasound = await seedRoomType('Siêu âm', 15);
  const roomTypeEcg = await seedRoomType('Điện tim', 10);
  const roomTypeConclusion = await seedRoomType('Tư vấn kết luận', 10);

  // P102 CỐ TÌNH không gán bác sĩ trực — dùng để test cảnh báo trên Dashboard
  const roomP101 = await seedRoom('P101', 'Phòng Nội 1', roomTypeInternal.id, RoomStatus.ACTIVE);
  const roomP102 = await seedRoom('P102', 'Phòng Nội 2', roomTypeInternal.id, RoomStatus.ACTIVE);
  const roomP103 = await seedRoom('P103', 'Phòng Mắt 1', roomTypeEye.id, RoomStatus.ACTIVE);
  await seedRoom('P104', 'Phòng Mắt 2 (bảo trì)', roomTypeEye.id, RoomStatus.MAINTENANCE);
  console.log('✅ Room: P101, P102 (không bác sĩ trực), P103 = ACTIVE · P104 = MAINTENANCE');

  console.log('\n--- 10 dịch vụ khám mô phỏng ---');
  const clinicServices = await seedClinicServices({
    vitalSigns: roomTypeVitalSigns.id,
    internal: roomTypeInternal.id,
    surgery: roomTypeSurgery.id,
    eye: roomTypeEye.id,
    ent: roomTypeEnt.id,
    dental: roomTypeDental.id,
    dermatology: roomTypeDermatology.id,
    obstetrics: roomTypeObstetrics.id,
    pediatrics: roomTypePediatrics.id,
    cardiology: roomTypeCardiology.id,
    laboratory: roomTypeLaboratory.id,
    imaging: roomTypeImaging.id,
    ultrasound: roomTypeUltrasound.id,
    ecg: roomTypeEcg.id,
    conclusion: roomTypeConclusion.id,
  });
  const generalCheckup = clinicServices.get('GENERAL_CHECKUP')!;
  const flow = generalCheckup.flow;
  const flowStepInternal = generalCheckup.stepsByCode.get('INTERNAL')!;
  const flowStepEye = generalCheckup.stepsByCode.get('EYE')!;

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
      flowStepId: flowStepInternal.id,
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
      flowStepId: flowStepEye.id,
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
      flowStepId: flowStepInternal.id,
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
