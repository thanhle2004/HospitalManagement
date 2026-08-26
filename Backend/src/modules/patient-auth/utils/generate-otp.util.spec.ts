import { generateOtpCode } from './generate-otp.util';

describe('generateOtpCode', () => {
  it('mặc định sinh mã 6 chữ số', () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('tôn trọng tham số length tuỳ chỉnh', () => {
    expect(generateOtpCode(4)).toMatch(/^\d{4}$/);
    expect(generateOtpCode(8)).toMatch(/^\d{8}$/);
  });

  it('không sinh ra số có chữ số 0 đứng đầu bị mất (đủ đúng độ dài)', () => {
    // Chạy nhiều lần để tăng khả năng bắt được trường hợp random ra số nhỏ
    for (let i = 0; i < 50; i++) {
      expect(generateOtpCode(6)).toHaveLength(6);
    }
  });

  it('sinh giá trị khác nhau giữa các lần gọi (không hardcode/không lặp cố định)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOtpCode()));
    // Với 6 chữ số (1 triệu khả năng), 20 lần gọi trùng nhau hoàn toàn là gần như không thể
    expect(codes.size).toBeGreaterThan(1);
  });
});
