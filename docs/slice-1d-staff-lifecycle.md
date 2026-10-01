# Slice 1D — Staff lifecycle và vai trò nghiệp vụ

Ngày triển khai local: **2026-10-01**

## Thay đổi

- Mở rộng `UserRole` với `NURSE`, `RECEPTIONIST`, `LAB_TECHNICIAN`, `PHARMACIST`, `CASHIER`.
- Migration additive seed năm system role tương ứng. Các role mới chưa được cấp permission nghiệp vụ chưa tồn tại; nguyên tắc mặc định là deny.
- `POST /api/v1/staff` tạo User, UserProfile, initial role assignment và audit trong cùng transaction.
- `PATCH /api/v1/staff/:id/status` khóa/mở/vô hiệu tài khoản, tăng token version và audit trong cùng transaction.
- Không cho actor tự khóa/vô hiệu hóa tài khoản đang dùng.
- Luồng tạo Doctor legacy được sửa để luôn tạo `DOCTOR` role assignment trong cùng transaction.
- Trang `/admin/roles` có form tạo Staff, chọn vai trò ban đầu và dialog xác nhận thay đổi trạng thái với lý do bắt buộc.

## Security posture

Role mới mặc định không có quyền business. Permission sẽ được thêm cùng module tương ứng (vital signs, appointment, lab, pharmacy, billing), tránh cấp trước quyền rộng như `visits.read` khi chưa có scope theo care relationship/facility.

## Routing impact

Không có thay đổi routing. Staff lifecycle chỉ tác động identity, role assignment, token version và audit.

## Lưu ý local development

Nếu backend `start:dev` đang chạy khi Prisma Client được generate trên Windows, query-engine DLL có thể bị khóa. Restart backend dev server rồi chạy `npm run prisma:generate` để process đang chạy nạp enum mới.
