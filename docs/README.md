# Hồ sơ khảo sát hệ thống Hospital Management

Ngày khảo sát: **2026-08-27**  
Phạm vi: `Backend/` và `Frontend/` trong workspace hiện tại. Giai đoạn khảo sát đã hoàn tất; **Slice 0 safety harness đã được triển khai local ngày 2026-08-27**. Không có migration/DDL nào được chạy trên database production.

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
| [slice-0-implementation.md](slice-0-implementation.md) | Thay đổi Slice 0, bằng chứng local, checksum, verification và gate production còn mở |

## Cập nhật sau khảo sát

Slice 0 đã xử lý Git baseline, request ID/log redaction, CORS allowlist, Swagger production policy, health/readiness, DB inventory/reconciliation, draft baseline, backup/restore rehearsal, CI và characterization test. Xem kết quả cùng các giới hạn production tại [slice-0-implementation.md](slice-0-implementation.md).

## Kết luận điều hành

Source hiện tại **đã dùng đúng họ công nghệ mục tiêu**: NestJS + TypeScript + Prisma/MySQL ở backend và Next.js App Router + TypeScript ở frontend. Vì vậy không nên “rewrite sang Next/Nest” lần nữa. Hướng ít rủi ro nhất là giữ backend hiện tại làm lõi tham chiếu, lập baseline database thật, khóa các bất biến nghiệp vụ bằng test, rồi mở rộng theo vertical slice.

Tuy nhiên đây chưa phải một Hospital Information System đầy đủ. Phạm vi hiện hữu chủ yếu là **tài khoản, bệnh nhân tự đăng ký OTP, workflow khám dạng DAG, điều phối phòng, QR check-in và hàng đợi**. Không có dữ liệu nghiệp vụ thực cho lịch hẹn, tiếp nhận chuẩn, chẩn đoán, hồ sơ bệnh án, xét nghiệm/kết quả, chẩn đoán hình ảnh, đơn thuốc/dược, kho, nội trú, hóa đơn, thanh toán, bảo hiểm hay báo cáo y tế.

Các blocker trước khi coi hệ thống sẵn sàng vận hành thật:

1. Đã inventory database local; vẫn chưa có dump/schema inventory từ database production đích.
2. Migration thứ hai có thao tác phá hủy dữ liệu mẫu (`DROP TABLE`, đổi PK, bỏ cột bắt buộc); tuyệt đối không replay lên database legacy có dữ liệu.
3. OTP/password log và CORS/WebSocket origin đã được xử lý ở Slice 0; token staff/refresh token vẫn lưu ở `localStorage` và thuộc Slice 1.
4. Khóa user/device không vô hiệu access token đã cấp; authorization mới ở mức role, chưa có phạm vi resource đầy đủ.
5. State machine còn trạng thái được khai báo nhưng không có đường chuyển; audit log chỉ bao phủ hai thao tác đổi thứ tự hàng đợi.
6. Đã có 31 unit/characterization test và DB/runtime smoke; vẫn thiếu authorization matrix và E2E nghiệp vụ đầy đủ.
7. Frontend chỉ có 8 màn hình thực, Doctor là placeholder, Patient portal và phần lớn vận hành khám chưa có UI.

Quyết định hiện tại: **Slice 0 đã triển khai local; chỉ chuyển Slice 1 sau khi các gate production và câu hỏi nghiệp vụ liên quan có owner phê duyệt**.
