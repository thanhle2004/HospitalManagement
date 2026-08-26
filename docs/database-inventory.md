# Inventory MySQL hiện tại

## 1. Nguồn bằng chứng

- Prisma schema: `Backend/prisma/schema.prisma` — 24 model, 13 enum.
- Migration history: `20260729074906_init` và `20260730025630_init`.
- Runtime query: các file `*.repository.ts`.
- Đã kết nối và chạy inventory read-only trên database local MySQL 8.0.41 ngày 2026-08-27. Kết quả local: 24 bảng domain + `_prisma_migrations`, không có view/procedure/trigger/event, schema không drift.
- Chưa có clone/dump production; kết quả local không thay thế inventory production.

### 1.1 Snapshot local đã kiểm chứng

- Inventory checksum: `7314a6f3d1d53ec0568211af7e5b1298c26fdde9f99e749c84860910dc022b06`.
- 20/20 reconciliation checks pass, checksum `15ac07446ece354bb57cab2a8450c64237a63ab8c2ed0003a2b6286cf88781ac`.
- Backup/restore count 25/25 bảng pass; xem [slice-0-implementation.md](slice-0-implementation.md).

## 2. Tổng quan schema

| Nhóm | Bảng | PK | Quan hệ/ràng buộc đáng chú ý | Dữ liệu nhạy cảm |
|---|---|---|---|---|
| Staff auth | `users` | `CHAR(36)` UUID | email unique; index role/status | email, password hash, login time |
| Staff auth | `user_profiles` | UUID | `user_id` unique FK cascade | tên, phone, DOB, address, avatar |
| Staff auth | `refresh_tokens` | UUID | FK user cascade; index user/expiry | token hash |
| Patient auth | `patient_otps` | UUID | optional FK patient set-null; index phone+purpose+expiry | phone, OTP hash, attempts |
| Patient auth | `patient_sessions` | UUID | FK patient cascade; index patient/expiry | refresh hash, IP, device info |
| Patient | `patient_types` | int AI | code unique; soft delete | không |
| Patient | `patients` | UUID | phone unique; FK type restrict | tên, phone, email, DOB, ID number, address, emergency contact |
| Facility | `room_types` | int AI | soft delete | không |
| Facility | `rooms` | int AI | room number unique; FK room type restrict | không |
| Queue | `room_queue_entries` | int AI | assignment unique; `(room_id, position)` unique | vị trí/luồng bệnh nhân gián tiếp |
| Staffing | `doctor_assignments` | int AI | FK doctor/room cascade; overlap không DB-enforced | lịch làm việc |
| Device | `devices` | UUID | code unique; FK room cascade | device secret hash, heartbeat/version |
| Runtime | `room_runtimes` | room id | current assignment unique; FK room cascade | trạng thái vận hành |
| Workflow | `flows` | int AI | code unique; soft delete | không |
| Workflow | `flow_steps` | int AI | `(flow_id, code)` unique; FK flow cascade/type restrict | không |
| Workflow | `flow_dependencies` | composite | hai FK step cascade | không |
| Visit | `visits` | UUID | FK patient/flow restrict; index patient/status | lịch sử sử dụng dịch vụ |
| Visit | `visit_steps` | int AI | FK visit cascade, flow step/type; index visit+status/type+status | lịch sử luồng khám |
| Visit | `visit_step_dependencies` | composite | hai FK visit step cascade | không |
| Routing | `visit_assignments` | int AI | FK step cascade, room/user; self-FK reroute | doctor-room-patient linkage |
| Routing | `visit_tokens` | UUID | assignment unique; token unique | QR bearer token plaintext |
| Check-in | `check_in_logs` | bigint AI | FK assignment cascade, optional device | scan time/error/device |
| Routing | `routing_queues` | step id | FK step cascade; status index | last error |
| Audit | `activity_logs` | bigint AI | optional user FK; entity/entity-id index | IP, user agent, arbitrary JSON metadata |

ERD đầy đủ: [current-database-erd.md](current-database-erd.md).

## 3. View, procedure, trigger và event

Không có câu lệnh `CREATE VIEW/PROCEDURE/FUNCTION/TRIGGER/EVENT` trong migration. Prisma schema cũng không khai báo view. Inventory local xác nhận số lượng đều bằng 0; vẫn cần chạy lại trên production clone:

```sql
SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE();
SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE();
SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE();
SELECT EVENT_NAME, STATUS, EVENT_DEFINITION FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE();
```

## 4. Đánh giá khóa, index và constraint

### Điểm tốt

- Các FK chính được khai báo, nhiều runtime child dùng cascade hợp lý.
- Unique cho email/phone/room/device/flow/QR token và composite dependency.
- Index phục vụ lookup phổ biến: user role/status, visit status, room type/status, assignment room/status, OTP/session expiry, audit entity.
- Lịch sử Visit copy workflow runtime, giảm phụ thuộc vào thay đổi Flow sau đó.

### Constraint thiếu hoặc chưa đủ

| Bất biến | Hiện trạng | Đề xuất, chưa thực hiện |
|---|---|---|
| Doctor shift không overlap | Check ở service rồi insert riêng | Transaction + lock/advisory lock; test concurrency; cân nhắc bảng slot chuẩn hóa |
| Step/required step cùng Flow/Visit | Chỉ service validate | Validation + reconciliation query; trigger chỉ nếu governance cho phép |
| `step_id != required_step_id` | Chỉ Zod/service | MySQL 8 `CHECK` trong migration SQL nếu version đích xác nhận |
| Step và Assignment state đồng bộ | Chỉ convention transaction | State transition service duy nhất + invariant test + reconciliation job |
| Một active assignment/step | Không có partial unique | Application lock/active pointer hoặc cấu trúc current assignment riêng |
| Một current exam/room | `room_runtimes.current...` unique + optimistic version | Giữ; thêm repair script khi drift |
| OTP consume một lần | `used_at` update không conditional | `UPDATE ... WHERE used_at IS NULL AND attempts < max` và kiểm tra affected rows |
| Queue append không trùng | Unique `(room,position)`, nhưng max+1 không lock | Transaction/row lock hoặc monotonic sequence per room |
| `cancel_reason` chỉ khi cancelled | Không có CHECK | Validation/state-machine test; CHECK nếu MySQL 8 |
| Temporal fields khớp status | Không có | Validation + reconciliation |
| Patient phone canonical unique | Unique chuỗi thô | Chuẩn hóa E.164 trước write; migration dedupe |
| Audit append-only | Không có DB protection | DB role chỉ INSERT/SELECT, immutable storage/hash chain theo yêu cầu |

## 5. Kiểu dữ liệu và tính nhất quán

- ID dùng hỗn hợp UUID `CHAR(36)`, int auto-increment và bigint. Không sai nhưng contract/API phải giữ rõ; UUID dạng text tốn index hơn `BINARY(16)`—không đổi nếu chưa benchmark và có migration an toàn.
- Hầu hết string dùng mặc định `VARCHAR(191)` do Prisma; address/description/error/user-agent có nguy cơ bị cắt hoặc quá ngắn.
- `RoomQueueEntry.position` là `DOUBLE`. Fractional ordering tích lũy sai số và cuối cùng có thể collision; chưa có rebalance.
- `DateTime` không ghi timezone semantic. Phải chốt lưu UTC, timezone hiển thị và daylight-saving cho thị trường triển khai.
- `identity_number`, phone, email chưa có canonicalization/encryption/tokenization.
- `ActivityLog.metadata` là JSON tự do, không có schema/version/redaction.
- QR token được lưu plaintext. Đây là bearer secret; cân nhắc chỉ lưu hash như refresh token nếu client chỉ cần đối chiếu.

## 6. Truy vấn có nguy cơ chậm hoặc tăng tải

| Query/use case | Rủi ro | Index/thiết kế cần đo |
|---|---|---|
| `GET /visits` | Không pagination, sort toàn bộ theo `created_at`; index chỉ status/patient | index `created_at`, pagination keyset, filter date/status |
| Dashboard “today” | Tải toàn bộ visits rồi filter ở browser | endpoint aggregate theo date/timezone |
| Admin queue toàn viện | Join sâu, không pagination | index queue room+position; projection; partition/filter room |
| Routing room candidates | Một `COUNT` cho từng room (N queries) | aggregate group-by một query; đo `room_id,status` index |
| Audit pagination | offset pagination chậm ở trang sâu | `(created_at,id)` và keyset; filter composite theo pattern thật |
| OTP latest | index `(phone,purpose,expires_at)` nhưng sort `created_at` | cân nhắc `(phone,purpose,created_at)` sau EXPLAIN |
| Session/refresh lookup | filter user+hash+revoked+expiry nhưng hash không index | unique/index token hash hoặc `(user_id,token_hash)` |
| Active shifts | OR trên nullable end time và thời gian hiện tại | EXPLAIN với composite hiện có; lock concurrency |
| Visit graph | nested include nhiều bảng | giới hạn projection, query count/load test |

Không thêm index chỉ từ bảng trên. Phải dùng slow-query log, `EXPLAIN ANALYZE`, cardinality và workload staging.

## 7. Bảng/cột không dùng hoặc dùng một phần

- Không có bảng hoàn toàn “không dùng” được chứng minh từ source.
- Các cột/state chưa có write path: `users.deleted_at`, patient session `device_info/ip_address`, `VisitStatus.IN_PROGRESS/CANCELLED`, `VisitStepStatus.CANCELLED`, assignment cancel fields, reroute chain, `RoutingStatus.PROCESSING`.
- `PatientOtp.linkToPatient()` tồn tại nhưng không được gọi; OTP register vẫn giữ `patient_id=null` sau success.
- `RoomQueueEntry.source` dùng AUTO lúc check-in và MANUAL lúc reorder, đúng mục đích.

Trước khi loại bỏ bất kỳ cột/bảng nào phải kiểm tra database thật, report/ETL bên ngoài và access log; source-only không đủ chứng minh “unused”.

## 8. Migration history và rủi ro bảo toàn dữ liệu

Migration đầu tạo demo `users/posts` với user ID int. Migration thứ hai:

- drop `posts`;
- drop các cột `users.name/password/createdAt/updatedAt`;
- đổi PK `users.id` từ int sang `CHAR(36)`;
- thêm cột bắt buộc không default (`password_hash`, `role`, `updated_at`).

File SQL tự cảnh báo không thể áp dụng an toàn khi `users` có dữ liệu. Vì vậy:

1. Không replay migration history này lên database legacy/production.
2. Dump schema-only + data profile database thật.
3. Tạo **baseline migration** đại diện đúng trạng thái đã tồn tại và mark applied trên clone.
4. Mọi thay đổi sau baseline dùng expand-and-contract và SQL review thủ công.
5. Viết reconciliation: record count, orphan, duplicate canonical phone/email, state pairs, queue uniqueness, amount totals khi billing xuất hiện.

## 9. Script đối soát tối thiểu cần tạo ở Slice 0

- Count theo từng bảng và theo status/date partition.
- Orphan FK (kể cả FK tắt hoặc dữ liệu cũ nhập tay).
- Duplicate phone sau canonicalization; duplicate identity/email tùy rule.
- Mismatch VisitStep ↔ active VisitAssignment.
- RoomRuntime trỏ assignment sai room/status.
- Queue entry trỏ assignment không CHECKED_IN/IN_PROGRESS.
- Visit COMPLETED nhưng còn unresolved step; Visit WAITING nhưng mọi step resolved.
- OTP/session/refresh/QR hết hạn chưa purge theo retention.
- Hash/checksum theo batch để so trước/sau migration.
