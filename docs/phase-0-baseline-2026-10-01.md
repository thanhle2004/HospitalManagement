# Giai đoạn 0 — Khảo sát và baseline hiện trạng

Ngày chụp baseline: **2026-10-01**  
Phạm vi: trạng thái worktree hiện tại của `Backend/`, `Frontend/`, Prisma schema, 7 migration và database MySQL local `hospital_management`.

## 1. Kết luận điều hành

Repository đã có một lõi vận hành thực cho đăng nhập, danh mục, workflow dạng DAG, tạo Visit, routing, QR check-in, hàng đợi, Doctor start/complete và simulation. Không nên viết lại lõi này. Code hiện tại đã vượt inventory tháng 8: có **29 Prisma model, 15 enum, 24 controller, 103 REST route, 23 backend module, 23 frontend page và 39 test suite backend**.

Baseline hiện tại xanh: Prisma validate/generate, backend lint/type-check/build, 291 test backend, frontend lint/type-check/build và 3 unit test frontend đều pass. Database local có 30 bảng (gồm `_prisma_migrations`), 7 migration, không có drift được Prisma báo cáo và 25/25 kiểm tra reconciliation sạch.

Chưa thể coi đây là baseline production: chưa có inventory từ production clone đã ẩn danh, E2E toàn hành trình chưa tồn tại, frontend test còn rất mỏng và worktree đang chứa nhiều thay đổi chưa commit liên quan simulation/routing. Không triển khai Giai đoạn 1 trên một nhánh release cho đến khi trạng thái này được review và đóng mốc Git.

## 2. Phạm vi đã kiểm tra

- Đọc `Frontend/AGENTS.md`, `Frontend/CLAUDE.md`, toàn bộ tài liệu trong `docs/`, `SIMULATION_AUDIT.md`, package scripts, Prisma schema/migration.
- Kiểm kê controller/route, role decorator, event producer/consumer, module, frontend route và test.
- Đọc các service/repository có quyền ghi `Visit`, `VisitStep`, `VisitAssignment`, `RoutingQueue`, `VisitToken`, `RoomQueueEntry`, `RoomRuntime`.
- Chạy gate build/test và inventory/reconciliation database local.
- Không sửa migration cũ, schema, routing core hay nghiệp vụ hiện hữu.

## 3. Baseline test report

| Gate | Kết quả 2026-10-01 |
|---|---|
| `npm run prisma:validate` | Pass |
| `npm run prisma:generate` | Pass — Prisma Client 5.22.0 |
| Backend `npm run typecheck` | Pass |
| Backend `npm run lint` | Pass |
| Backend `npm run build` | Pass |
| Backend `npm run test:ci` | Pass — **39/39 suites, 291/291 tests** |
| Frontend `npm run typecheck` | Pass |
| Frontend `npm run lint` | Pass |
| Frontend `npm run test:unit` | Pass — **3/3 tests** |
| Frontend `npm run build` | Pass — 25 routes generated |
| `prisma migrate status` | Pass — 7 migrations, schema up to date |
| `npm run db:inventory` | Pass — 30 tables, 0 view/trigger/routine/event |
| `npm run db:reconcile` | Pass — **25 checks, 0 error, 0 warning** |

Database evidence:

- `artifacts/db-inventory/inventory-2026-10-01T06-34-20-199Z.json`, SHA-256 `3a330ebc2200256ff30f3b01bbaa4662139bcf5564fb921da0c47c5ea3dc0f3d`.
- `artifacts/db-reconciliation/reconciliation-2026-10-01T06-34-21-802Z.json`, SHA-256 `d98216f385955414b793b4d04d09b1c924d3eb4646c540a049d60007980572d9`.

Ghi chú: Jest cố ý ghi `console.error` trong test observer-failure của simulation; suite vẫn pass và đây không phải test failure. Frontend unit test có cảnh báo Node experimental type stripping/module type, không làm gate thất bại.

## 4. Inventory chức năng thực tế

### Admin

- Quản lý Doctor, patient type, patient, room type, room, QR device, doctor assignment, flow/step/dependency.
- Xem và can thiệp thứ tự queue; xem activity log.
- Kích hoạt routing thủ công.
- Tạo/chạy/tạm dừng/tiếp tục/dừng/xóa simulation và so sánh chiến lược.
- Dashboard tổng quan hiện vẫn chủ yếu dựa trên các module hiện hữu; chưa có reporting/finance/clinical aggregate hoàn chỉnh.

### Doctor

- Xem/confirm ca trực tại phòng, xem queue, start và complete exam.
- Có API legacy thêm ad-hoc VisitStep và skip optional step.
- Chưa có vital sign workspace, bệnh án, chẩn đoán, clinical order, đơn thuốc hoặc ký hồ sơ.

### Patient

- Đăng ký/đăng nhập OTP hoặc Firebase, refresh/logout, xem hồ sơ.
- Xem service/flow, tạo Visit, xem danh sách và chi tiết Visit/QR.
- Chưa có appointment, medical record/result/prescription/invoice/payment/revisit.

### Device

- Đăng nhập bằng secret riêng và QR check-in.
- Token version/status đã được kiểm tra trong auth foundation hiện tại.

## 5. Routing core phải đóng băng

Các file/boundary dưới đây là routing core hoặc trực tiếp duy trì invariant routing. Không chỉnh sửa trong các slice mới nếu chưa có proposal và phê duyệt rõ ràng.

| Boundary | File/chức năng chính |
|---|---|
| Khởi tạo Visit graph | `Backend/src/modules/visits/visits.service.ts`; repositories `visit-steps`, `visit-step-dependencies`, `routing-queue` |
| Chọn phòng và assignment/token | `Backend/src/modules/routing/routing-engine.service.ts`, toàn bộ `routing/strategies`, repositories `visit-assignments`, `visit-tokens`, `routing-decisions` |
| QR check-in/queue | `Backend/src/modules/check-in/check-in.service.ts`, `room-queue-entries.repository.ts`, `check-in-logs.repository.ts` |
| Chiếm/giải phóng phòng | `Backend/src/modules/rooms/room-runtime.repository.ts`, `Backend/src/modules/doctor/doctor.service.ts` |
| Mở dependency tiếp theo | `Backend/src/modules/doctor/doctor.service.ts`, `Backend/src/modules/visits/visits.service.ts` |
| Domain events | `visit-step.ready`, `visit.updated`, `room-queue.updated` và handlers trong routing/realtime |
| Persistence/state | Prisma models `Visit`, `VisitStep`, `VisitStepDependency`, `VisitAssignment`, `RoutingQueue`, `VisitToken`, `RoomQueueEntry`, `RoomRuntime`, `CheckInLog` |
| Simulation regression harness | Toàn bộ `Backend/src/modules/simulation/` và UI `Frontend/src/features/simulation/` |

Simulation được phép gọi public application services để kiểm chứng lõi; module nghiệp vụ mới không được sao chép hay ghi trực tiếp các bảng routing.

### Frozen legacy surfaces cần phê duyệt trước mọi thay đổi

- `POST /visits/:id/steps`: chèn bước phát sinh.
- `POST /visits/:id/steps/:stepId/skip`: hủy/bỏ qua bước trong graph.
- `POST /admin/queue/:id/move-to-front` và `move-after`: đổi thứ tự hàng đợi.
- Cleanup simulation/check-in có ghi trực tiếp các bảng routing để dọn dữ liệu sở hữu bởi run/assignment; chỉ được coi là ngoại lệ hiện hữu, không phải extension point cho module mới.

## 6. State transition hiện hữu

```text
Visit: CREATED -> WAITING -> IN_PROGRESS -> COMPLETED
                                \-> CANCELLED (enum có; đường chuyển nghiệp vụ chưa hoàn chỉnh)

VisitStep: LOCKED -> READY -> ASSIGNED -> CHECKED_IN -> IN_PROGRESS -> COMPLETED
                    \-> SKIPPED/CANCELLED (chỉ một phần use case hiện hữu)

VisitAssignment: WAITING -> CHECKED_IN -> IN_PROGRESS -> COMPLETED
                                      \-> CANCELLED

RoutingQueue: PENDING -> PROCESSING -> FAILED/retry -> removed after successful assignment

RoomRuntime: idle -> currentVisitAssignmentId set atomically -> cleared on completion
RoomQueueEntry: created only after valid QR check-in -> removed on exam completion
```

Invariant được test hiện tại: tạo graph từ flow, root step READY, claim routing chống duplicate, chọn phòng theo strategy, tạo assignment/token, check-in đồng bộ step/assignment và enqueue, room chỉ được claim một assignment, complete giải phóng runtime/dequeue, dependency được mở và event routing tiếp tục. Simulation seed/engine có test tất định; live concurrent completion vẫn được `SIMULATION_AUDIT.md` đánh dấu chưa giải quyết.

## 7. Dependency map cho hành trình đích

```text
Identity/RBAC/Audit
  -> Staff management + mọi clinical/financial authorization
Appointment -> idempotent Visit creation -> [routing core giữ nguyên]
Visit -> VitalSign
Visit/VisitStep -> MedicalRecord -> Diagnosis
MedicalRecord -> ClinicalOrder -> ClinicalResult/Attachment
MedicalRecord + Medication -> Prescription -> Dispensation
Visit + Order + Dispensation -> Invoice -> Payment/Refund
Visit + signed clinical artifacts -> Completion policy -> Follow-up/Appointment
Domain events -> Notification/Preference -> Socket/email/SMS adapters
All modules -> AuditEvent + scoped search/report projections
```

Không module mới nào được phụ thuộc repository routing. Integration hợp lệ là tham chiếu ID, gọi public application service đã duyệt, hoặc lắng nghe event mà không mutation routing.

## 8. Gap analysis

| Năng lực | Hiện trạng | Gap chính | Giai đoạn |
|---|---|---|---|
| Staff/RBAC | `User.role` đơn trị ADMIN/DOCTOR; role guard | Chưa multi-role, permission, history, scope/resource policy | 1 |
| Audit | `ActivityLog`, chủ yếu queue intervention | Chưa phủ auth, clinical read/write/sign, finance/export; schema actor/context còn hạn chế | 1 |
| Notification | Realtime invalidation event | Chưa persistence, read state, preference, delivery adapter | 2 |
| Reception/vitals | Không có | Toàn bộ model/API/UI/test | 3 |
| EMR/diagnosis | Không có | Draft/sign/amend/revision/ICD/publication | 4 |
| Clinical orders/results | Không có | Lifecycle, result items, files, verifier; routing extension cần duyệt riêng | 5 |
| Medication/prescription | Không có | Catalog, immutable signing, allergy/duplicate active ingredient warnings, dispensing | 6 |
| Appointment | Không có | Schedule/capacity/history/idempotent Visit creation | 7 |
| Billing/payment | Không có | Decimal ledger, issue/pay/refund/idempotency | 8 |
| Visit completion/follow-up | Routing completion hiện hữu | Chưa policy clinical/financial độc lập và summary/revisit | 9 |
| Operational exceptions | Một số legacy queue/step action | Chưa state proposal an toàn; mọi thay đổi routing cần approval | 10 |
| Reporting/search | Activity log pagination và dashboard giới hạn | Thiếu aggregate/scoped global search/export | 11 |
| Patient portal | Profile/service/Visit/QR | Thiếu toàn bộ clinical, appointment, finance, notification | 12 |
| Security/test/performance | Auth hardening + 291 backend tests | Thiếu full auth matrix, E2E, frontend component coverage, load/concurrency production evidence | 13 |

## 9. Permission matrix mục tiêu (đề xuất để phê duyệt)

Ký hiệu: `M` quản trị, `W` tạo/cập nhật trong phạm vi, `R` đọc trong phạm vi, `S` ký/xác nhận bất biến, `—` cấm. Mọi quyền đều phải kiểm tra backend; `PATIENT` luôn bị giới hạn tài nguyên của chính mình.

| Resource/action | ADMIN | DOCTOR | NURSE | RECEPTIONIST | LAB TECH | PHARMACIST | CASHIER | PATIENT |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Staff/account/role | M | self R/W | self R/W | self R/W | self R/W | self R/W | self R/W | — |
| Master data room/service | M | R | R | R | R | R | R | R published |
| Patient demographics | R/W admin fields | R scoped | R scoped | R/W registration | R minimum | R minimum | R billing minimum | own R/W allowed fields |
| Appointment/reception | R/M policy | R scoped | R | W | R assigned | — | R | own R/W policy |
| Vital signs | R | R/W scoped | R/W scoped | R | R | — | — | own R published |
| Medical record/diagnosis | R metadata; no signed-content edit | R/W/S scoped | R limited; no sign | — | R order context | R prescription context | — | own R published |
| Clinical order/result | R | W/S order, R result | W order support | — | R/W/S assigned result | — | — | own R published |
| Prescription | R | W/S scoped | R | — | — | R; no content edit | — | own R |
| Dispensation | R | R | — | — | — | W/S | R charge | own R |
| Invoice/payment/refund | M policy; audited | R summary | — | R estimate | — | R medication charge | W/S; refund per approval | own R/pay |
| Routing/queue | Existing admin operations only | Existing assigned actions | R assigned only | R only until policy | — | — | — | own status |
| Audit/report/export | R per permission | own/scoped R | scoped R | scoped R | scoped R | scoped R | finance R | own export only |

Các quyết định còn cần owner: facility scope, care-team relationship, break-glass, dual approval, ai được amend signed record, refund threshold, publication timing và retention.

## 10. Roadmap theo vertical slice

1. **1A — Permission catalog và multi-role foundation**: additive RBAC tables, centralized permission guard/policy, seed mapping tương thích ADMIN/DOCTOR; không đổi auth/device/patient token contract.
2. **1B — Staff lifecycle**: create/update/lock/unlock, assign/revoke role, role history, pagination và audit đầy đủ.
3. **1C — Self-service/session hardening**: profile, password, session list/revoke; authorization matrix tests.
4. **1D — Audit platform**: actor/request/client context, redaction, reason, clinical-read ready API.
5. **2A–2C — Notification persistence, preferences, realtime/adapters**.
6. **3A–3B — VitalSign backend rồi Nurse/Doctor UI**.
7. **4A–4C — MedicalRecord draft, sign, amendment/publication**.
8. **5A–5C — Independent ClinicalOrder/result; routing integration là slice riêng cần phê duyệt**.
9. **6A–6C — Medication, prescription signing, dispensing**.
10. **7A–7C — Staff schedule/appointment, reschedule/cancel, idempotent Visit handoff**.
11. **8A–8C — Invoice, payment, refund/receipt**.
12. **9A–9B — Completion policy/post-completion summary/follow-up**.
13. **10.x — Mỗi ngoại lệ một proposal + regression-first + approval nếu chạm core**.
14. **11–13 — Aggregate/search/export, patient portal expansion, E2E/security/performance hardening**.

## 11. Vertical slice đầu tiên đề xuất: 1A RBAC foundation

### Actor và use case

Admin cấu hình/gán role cho Staff; mọi request Staff được authorize bằng permission tập trung. Existing ADMIN/DOCTOR tiếp tục có quyền tương đương trước cutover.

### Database additive dự kiến

- `Role`, `Permission`, `RolePermission`, `UserRoleAssignment` (không dùng tên `UserRole` vì đang trùng Prisma enum).
- `RoleAssignmentHistory` hoặc audit event có payload chuẩn hóa cho grant/revoke.
- Giữ `users.role` trong giai đoạn compatibility; backfill assignment từ enum; dual-read/feature flag trước khi contract field cũ.
- Index/unique: role code, permission code, `(roleId, permissionId)`, `(userId, roleId)`; không cascade xóa lịch sử/audit.

### API dự kiến

- `GET /api/v1/permissions`.
- CRUD tối thiểu cho `/api/v1/roles` với pagination và validation.
- `GET/POST/DELETE /api/v1/staff/:id/roles` với reason và idempotency phù hợp.
- Không đổi endpoint auth legacy trong slice này.

### Permission ban đầu

Tạo permission code tập trung theo resource/action, nhưng chỉ seed mapping tương đương hành vi đang có. Không tự cấp quyền clinical/finance chưa tồn tại. Guard mới chạy shadow/compatibility tests trước khi trở thành enforcement source duy nhất.

### Audit

Ghi actor, effective roles, action, target, request ID, IP/client context, reason và before/after đã redact. Không log token/password/OTP/clinical payload.

### Test plan

- Migration/backfill với user ADMIN/DOCTOR hiện hữu; rollback code không cần drop table.
- Allowed/denied cho Admin, Doctor, locked account, stale token version.
- Multi-role union, revoke có hiệu lực, duplicate grant idempotent, transaction rollback.
- Existing auth/device/patient suites và toàn bộ 291 routing/simulation tests phải tiếp tục xanh.
- Frontend role management có loading/empty/error/retry/confirm; API authorization là nguồn sự thật.

### Ảnh hưởng routing

**Không có thay đổi schema hoặc thuật toán routing.** Slice chỉ thay cách Staff endpoint được authorize. Các endpoint routing/doctor/check-in phải có characterization test chứng minh mapping permission mới tương đương role guard cũ trước khi bật enforcement. Không sửa state, event, strategy, repository hay simulation.

### Rủi ro và rollback

- Rủi ro lớn nhất là lockout do mapping permission thiếu. Giảm thiểu bằng backfill, compatibility read, bootstrap Admin không thể tự thu hồi quyền cuối cùng và matrix test.
- Rollback bằng tắt feature flag/quay lại `users.role`; giữ bảng additive và dữ liệu audit, không down migration phá hủy.

## 12. Điều kiện trước khi bắt đầu 1A

1. Owner phê duyệt permission matrix tối thiểu và quyết định một Staff có được multi-role thực sự ngay Slice 1 hay chỉ chuẩn bị schema.
2. Chốt naming `UserRoleAssignment` và chiến lược compatibility với enum `UserRole`.
3. Review/commit riêng worktree simulation hiện tại để có mốc rollback rõ ràng.
4. Chạy baseline trên production clone đã ẩn danh hoặc ít nhất schema dump production; không dùng bằng chứng local thay production sign-off.
5. Giữ nguyên bốn frozen legacy endpoint nêu trên cho đến khi có proposal riêng.

