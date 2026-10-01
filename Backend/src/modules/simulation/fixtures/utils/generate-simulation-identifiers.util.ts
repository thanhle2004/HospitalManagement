/**
 * Sinh các định danh (phone, email, code) cho fixture tổng hợp của Simulator.
 *
 * Cố tình KHÔNG sinh ra chuỗi trông giống số điện thoại/email thật — mục
 * đích là để không bao giờ bị nhầm với, hoặc va chạm với, dữ liệu bệnh
 * nhân/bác sĩ thật, và để không thể vô tình nhận được OTP thật nếu luồng
 * patient-auth từng bị gọi nhầm với 1 patient tổng hợp.
 *
 * Duy nhất trong phạm vi 1 run: mọi định danh đều nhúng 8 ký tự đầu của
 * runId + chỉ số tuần tự, nên 2 run khác nhau không bao giờ va chạm dù
 * chạy song song.
 */

const runPrefix = (runId: string): string => runId.replace(/-/g, '').slice(0, 8);

/** VD: SIM-9f2c8ab1-P0007 — không hợp lệ như số điện thoại thật, tránh đụng độ patients.phone (unique) */
export function simulationPatientPhone(runId: string, index: number): string {
  return `SIM-${runPrefix(runId)}-P${String(index).padStart(4, '0')}`;
}

export function simulationPatientFullName(index: number): string {
  return `Bệnh nhân mô phỏng P${String(index).padStart(4, '0')}`;
}

/** VD: sim.9f2c8ab1.d02@simulation.invalid — miền .invalid theo RFC 2606, không thể gửi mail thật tới đây */
export function simulationDoctorEmail(runId: string, index: number): string {
  return `sim.${runPrefix(runId)}.d${String(index).padStart(3, '0')}@simulation.invalid`;
}

export function simulationDoctorFullName(index: number): string {
  return `Bác sĩ mô phỏng D${String(index).padStart(3, '0')}`;
}

/** VD: SIM-9F2C8AB1-DEV007 — trùng quy ước viết hoa với Device.code hiện có trong seed */
export function simulationDeviceCode(runId: string, roomId: number): string {
  return `SIM-${runPrefix(runId).toUpperCase()}-ROOM${roomId}`;
}