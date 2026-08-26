# Hồ sơ khảo sát hệ thống Hospital Management

Ngày khảo sát: **2026-08-27**  
Phạm vi: `Backend/` và `Frontend/` trong workspace hiện tại. Đây là **Giai đoạn 1 — chỉ khảo sát và lập kế hoạch**, chưa refactor ứng dụng, chưa chạy migration, chưa kết nối hay thay đổi database production.

## Danh mục tài liệu

| Tài liệu | Nội dung |
|---|---|
| [legacy-system-audit.md](legacy-system-audit.md) | Stack, cấu trúc, entry point, auth, triển khai, tích hợp, technical debt và kết luận khảo sát |
| [business-modules.md](business-modules.md) | Inventory module, vai trò, luồng, validation, trạng thái, API, bảng, quyền và trường hợp đặc biệt |
| [database-inventory.md](database-inventory.md) | Inventory 24 bảng MySQL, khóa/index, dữ liệu nhạy cảm, truy vấn và rủi ro dữ liệu |
| [api-inventory.md](api-inventory.md) | Inventory đầy đủ 73 REST endpoint, WebSocket, cron và sự kiện nội bộ |
| [migration-risks.md](migration-risks.md) | Risk register, technical debt, ưu tiên xử lý và guardrail dữ liệu |
| [current-architecture.md](current-architecture.md) | Sơ đồ kiến trúc và phụ thuộc hiện tại |
| [current-database-erd.md](current-database-erd.md) | ERD hiện tại ở mức bảng và quan hệ chính |
| [feature-migration-matrix.md](feature-migration-matrix.md) | Ma trận chức năng hiện tại → module đích → API đích → màn hình đích |
| [target-architecture.md](target-architecture.md) | Kiến trúc modular monolith đề xuất và đánh giá Prisma/TypeORM |
| [threat-model.md](threat-model.md) | Threat model cho các luồng nhạy cảm được yêu cầu |
| [migration-plan.md](migration-plan.md) | Kế hoạch migration theo vertical slice, tiêu chí nghiệm thu và rollback |
| [business-questions.md](business-questions.md) | Câu hỏi nghiệp vụ/dữ liệu cần xác nhận trước Giai đoạn 2 |

## Kết luận điều hành

Source hiện tại **đã dùng đúng họ công nghệ mục tiêu**: NestJS + TypeScript + Prisma/MySQL ở backend và Next.js App Router + TypeScript ở frontend. Vì vậy không nên “rewrite sang Next/Nest” lần nữa. Hướng ít rủi ro nhất là giữ backend hiện tại làm lõi tham chiếu, lập baseline database thật, khóa các bất biến nghiệp vụ bằng test, rồi mở rộng theo vertical slice.

Tuy nhiên đây chưa phải một Hospital Information System đầy đủ. Phạm vi hiện hữu chủ yếu là **tài khoản, bệnh nhân tự đăng ký OTP, workflow khám dạng DAG, điều phối phòng, QR check-in và hàng đợi**. Không có dữ liệu nghiệp vụ thực cho lịch hẹn, tiếp nhận chuẩn, chẩn đoán, hồ sơ bệnh án, xét nghiệm/kết quả, chẩn đoán hình ảnh, đơn thuốc/dược, kho, nội trú, hóa đơn, thanh toán, bảo hiểm hay báo cáo y tế.

Các blocker trước khi coi hệ thống sẵn sàng vận hành thật:

1. Chưa có dump/schema inventory từ database đích; chỉ có Prisma schema và hai migration trong source.
2. Migration thứ hai có thao tác phá hủy dữ liệu mẫu (`DROP TABLE`, đổi PK, bỏ cột bắt buộc); tuyệt đối không replay lên database legacy có dữ liệu.
3. OTP và số điện thoại đang được log plaintext; token staff/refresh token lưu ở `localStorage`; CORS và WebSocket origin mở rộng.
4. Khóa user/device không vô hiệu access token đã cấp; authorization mới ở mức role, chưa có phạm vi resource đầy đủ.
5. State machine còn trạng thái được khai báo nhưng không có đường chuyển; audit log chỉ bao phủ hai thao tác đổi thứ tự hàng đợi.
6. Test hiện chỉ có 19 unit test cho thuật toán graph và sinh OTP; không có integration/API/E2E/authorization/migration test.
7. Frontend chỉ có 8 màn hình thực, Doctor là placeholder, Patient portal và phần lớn vận hành khám chưa có UI.

Quyết định đề xuất: **duyệt Phase 1, sau đó làm Slice 0 “baseline + safety harness” trước mọi chức năng mới**.
