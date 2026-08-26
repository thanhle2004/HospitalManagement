# Slice 0 — Baseline và safety harness

Ngày triển khai local: **2026-08-27**
Trạng thái: **đã triển khai và kiểm chứng trên database local; chưa được coi là production sign-off**.

## 1. Quyết định đã chốt

- Giữ nguyên `Backend/` và `Frontend/` với hai `package-lock.json`; chưa đổi sang workspace/monorepo package manager trong Slice 0.
- Tạo Git baseline trước khi sửa: commit `ce57311`, tag `legacy-audit-baseline-2026-08-27`.
- Không replay hai migration lịch sử lên database có sẵn. Baseline mới chỉ được sinh dưới dạng draft, không chạy DDL và không ghi `_prisma_migrations`.
- Migration không còn chạy cùng startup API. Docker có job `migrate` riêng thuộc profile `operations`.

## 2. Safety harness đã triển khai

### Runtime/API

- `GET /health/live`: chỉ xác nhận process sống.
- `GET /health/ready`: kiểm tra kết nối MySQL; `GET /health` được giữ để tương thích.
- Mọi HTTP response có `X-Request-Id` và `requestId` trong envelope; request ID không hợp lệ được thay bằng UUID.
- Request log ở dạng JSON, chỉ chứa controller/handler/status/duration; không log body, query string, token hay định danh bệnh nhân.
- Unknown exception được redaction và không log stack/raw database error ở production.
- OTP, số điện thoại và password seed không còn được ghi plaintext ra log.
- HTTP và Socket.IO dùng `CORS_ORIGINS` allowlist; wildcard bị validation từ chối.
- Helmet được bật. Swagger mặc định tắt ở production, chỉ bật khi `SWAGGER_ENABLED=true`.
- Shutdown hook được bật để Prisma đóng kết nối có kiểm soát.

### Database safety

- `npm run db:inventory`: snapshot chỉ metadata, object name, index/constraint và record count; không trích dữ liệu hàng.
- `npm run db:reconcile`: 20 invariant check chỉ trả aggregate count, exit code `2` nếu có lỗi mức `error`.
- `npm run db:drift:check`: so live schema với `schema.prisma`, không thay đổi DB.
- `npm run db:baseline:draft`: chỉ sinh SQL khi drift check bằng 0; output nằm trong `artifacts/` và mang trạng thái `DRAFT_NOT_APPLIED`.
- `npm run db:backup`: `mysqldump --single-transaction`, kèm SHA-256 và exact record count từng bảng.
- `restore-rehearsal.ps1`: kiểm checksum, restore vào database tên ngẫu nhiên có prefix an toàn, đối chiếu từng bảng rồi xóa đúng database diễn tập vừa tạo.

### CI và source control

- GitHub Actions có ba gate: secret scan, backend + MySQL 8, frontend.
- Backend gate chạy generate/validate Prisma, typecheck, lint, 31 test, build, migration trên DB rỗng, drift, reconciliation và runtime health smoke.
- Frontend gate chạy lint, typecheck và production build.
- Gitleaks scan toàn lịch sử Git; Dependabot theo dõi hai npm project và GitHub Actions.
- Dependency audit được chạy nhưng tạm là cảnh báo, vì nâng major NestJS/Swagger nằm ngoài quyền phê duyệt Slice 0.

## 3. Bằng chứng database local

Target đã kiểm tra là MySQL Community **8.0.41**, schema `hospital_management`, `utf8mb4_unicode_ci`. Đây là database local trong workspace, không được suy diễn là production.

| Bằng chứng | Kết quả |
|---|---|
| Inventory | 24 bảng domain + `_prisma_migrations`; 0 view, 0 trigger, 0 routine, 0 event |
| Migration history | 2 migration, Prisma báo up-to-date |
| Inventory SHA-256 | `7314a6f3d1d53ec0568211af7e5b1298c26fdde9f99e749c84860910dc022b06` |
| Reconciliation | 20 checks, 0 error, 0 warning |
| Reconciliation SHA-256 | `15ac07446ece354bb57cab2a8450c64237a63ab8c2ed0003a2b6286cf88781ac` |
| Schema drift | Không có khác biệt |
| Draft baseline SHA-256 | `b30b9950206018aaab6106a3474f373b4a412649c9e3971e390167cbf3175967` |
| Backup SHA-256 | `e929b516bd7768ecdaa921a5ecfedefaf22ccc8014b7df985c38746c04b66520` |
| Restore rehearsal | Pass, 25/25 bảng khớp count, 5.102 giây; DB tạm đã xóa |

Record count tại snapshot:

| Bảng | Rows | Bảng | Rows |
|---|---:|---|---:|
| `_prisma_migrations` | 2 | `activity_logs` | 0 |
| `check_in_logs` | 0 | `devices` | 0 |
| `doctor_assignments` | 2 | `flow_dependencies` | 0 |
| `flow_steps` | 1 | `flows` | 1 |
| `patient_otps` | 0 | `patient_sessions` | 0 |
| `patient_types` | 1 | `patients` | 3 |
| `refresh_tokens` | 33 | `room_queue_entries` | 2 |
| `room_runtimes` | 4 | `room_types` | 2 |
| `rooms` | 4 | `routing_queues` | 0 |
| `user_profiles` | 4 | `users` | 4 |
| `visit_assignments` | 3 | `visit_step_dependencies` | 0 |
| `visit_steps` | 3 | `visit_tokens` | 0 |
| `visits` | 3 |  |  |

Các JSON/SQL/backup chi tiết nằm trong `artifacts/`, được `.gitignore` bảo vệ vì có tính vận hành và có thể chứa metadata nhạy cảm.

## 4. Verification local

| Gate | Kết quả |
|---|---|
| Backend lint/typecheck/build | Pass |
| Backend Jest | 8 suites, 31/31 tests pass |
| Characterization | Staff login, Visit create, QR check-in, Doctor start exam pass |
| Frontend lint/typecheck/build | Pass; 11 route ứng dụng + `_not-found` được build tĩnh |
| Runtime smoke | `/health/live` và `/health/ready` trả 200; request ID được propagate |
| CORS smoke | Origin allowlist có header; origin ngoài allowlist không có `Access-Control-Allow-Origin` |
| Gitleaks 8.30.1 | Baseline Git và staged source snapshot của Slice 0 không phát hiện secret; CI sẽ scan lại toàn lịch sử sau push |
| YAML | CI, Dependabot và Docker Compose parse thành công |

## 5. Gate còn mở trước production

1. Chưa có schema-only dump hoặc clone ẩn danh của **database production thật**; inventory trên chỉ chứng minh local.
2. RPO/RTO chưa có owner phê duyệt. Thời gian restore 5.102 giây của dataset local rất nhỏ không phải cam kết production.
3. Draft baseline chưa được DBA review và tuyệt đối chưa được `prisma migrate resolve --applied` trên production.
4. GitHub Actions mới được cấu hình và kiểm tra từng lệnh local; cần push lên remote để có run đầu tiên được lưu làm bằng chứng.
5. Docker daemon không có trên máy kiểm tra; Dockerfile/Compose chưa build runtime local dù YAML đã parse.
6. Audit dependency còn mở: backend production tree có 18 advisory (4 high, 14 moderate); frontend có 1 high. Không chạy `audit fix --force` vì sẽ nâng major ngoài phạm vi phê duyệt.
7. Mock SMS đã ngừng lộ OTP nên không còn cách manual-copy OTP từ log. Muốn test patient E2E phải inject test sender hoặc cấu hình SMS sandbox không ghi secret vào log.

## 6. Cách chạy lại

Trong `Backend/`:

```powershell
npm run prisma:validate
npm run db:inventory
npm run db:reconcile
npm run db:drift:check
npm run db:baseline:draft
npm run db:backup
```

Restore rehearsal dùng backup vừa sinh:

```powershell
powershell -NoProfile -File scripts/database/restore-rehearsal.ps1 `
  -BackupPath "<absolute-path-to-backup.sql>"
```

## 7. Rollback

Các thay đổi Slice 0 là code/config/script; không có DDL chạy trên database nguồn. Có thể đối chiếu với tag `legacy-audit-baseline-2026-08-27` và revert commit Slice 0. Backup/restore rehearsal chỉ tạo rồi xóa database tạm có prefix `hm_restore_`; database `hospital_management` không bị restore đè.
