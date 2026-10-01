# Hospital Management — Project North Star

Ngày checkpoint: **2026-10-01**  
Baseline đánh giá: **Foundation closed tại Slice 1H; owner-approved Simulation Benchmark exception hoàn tất, roadmap trở lại 2A**
Trạng thái: **tài liệu canonical cấp dự án; phải đọc trước mọi slice mới**

## 1. System objective

Phát triển dần repository hiện hữu thành nền tảng quản lý khám chữa bệnh ngoại trú, bao phủ hành trình từ định danh bệnh nhân, lịch hẹn/tiếp nhận, Visit, điều phối phòng, khám lâm sàng, cận lâm sàng, kê/cấp thuốc, hóa đơn/thanh toán, hoàn tất và tái khám.

Hệ thống **không được viết lại từ đầu**. Lõi phân luồng bệnh nhân đang hoạt động là tài sản cần bảo toàn; module mới tích hợp quanh lõi bằng ID tham chiếu, public application service hoặc domain event đã duyệt.

## 2. Scope và non-goals

### In scope

- Web/BFF Next.js cho Staff và Patient; NestJS modular monolith; MySQL/Prisma.
- Identity riêng cho Staff, Patient và QR Device.
- Quản trị nhân viên/RBAC/audit; patient master; appointment/reception.
- Visit ngoại trú, workflow template, routing, QR check-in, queue và doctor execution.
- Vital signs, EMR/diagnosis, clinical orders/results, pharmacy, billing/payment.
- Notification/realtime, reporting/search/export và patient portal.
- Incremental migration, reconciliation, security, test và operational hardening.

### Explicit non-goals hiện tại

- Không rewrite stack hoặc chuyển microservice/ORM chỉ để “hiện đại hóa”.
- Không thay thuật toán routing, priority/FIFO, ETA hoặc state machine routing khi chưa có proposal và phê duyệt.
- Không triển khai inpatient/ward/bed, insurance claim, PACS/RIS/LIS sâu hoặc kho dược đầy đủ nếu business owner chưa đưa vào scope được duyệt. Đây là capability tiềm năng, không phải cam kết ngầm.
- Không tự tuyên bố tuân thủ HIPAA hoặc pháp lý cụ thể khi chưa có đánh giá pháp vực.
- Không tự xây dữ liệu tương tác thuốc/ICD/LOINC thiếu nguồn được kiểm chứng.

## 3. Actors

| Actor | Trách nhiệm mục tiêu |
|---|---|
| ADMIN | Quản trị danh mục, cơ sở vật chất, Staff/RBAC, vận hành và báo cáo; không mặc nhiên sửa nội dung chuyên môn đã ký |
| DOCTOR | Khám, chẩn đoán, chỉ định, kê đơn, ký/amend hồ sơ trong phạm vi công việc |
| NURSE | Tiếp nhận lâm sàng, sinh hiệu và hỗ trợ chăm sóc; không ký chẩn đoán thay Doctor |
| RECEPTIONIST | Tạo/quản lý lịch hẹn, thông tin hành chính và tiếp nhận |
| LAB_TECHNICIAN | Tiếp nhận/thực hiện/trả kết quả cận lâm sàng được phân công; không kê đơn |
| PHARMACIST | Kiểm tra và cấp thuốc; không sửa chẩn đoán/nội dung đơn đã ký |
| CASHIER | Hóa đơn, thanh toán, hoàn tiền theo quyền; không sửa hồ sơ y tế |
| PATIENT | Quản lý dữ liệu được phép và chỉ truy cập tài nguyên của chính mình |
| QR DEVICE | Xác thực riêng và check-in đúng phòng/assignment; không có quyền Staff |

Role mới ngoài ADMIN/DOCTOR hiện đã tồn tại trong schema nhưng mặc định không có business permission cho đến khi domain tương ứng được triển khai.

## 4. Domain map và data ownership

| Domain owner | Dữ liệu/capability |
|---|---|
| Identity & Access | `users`, `user_profiles`, `refresh_tokens`, Role/Permission/assignment, Staff auth/session |
| Patient Identity | OTP, Patient session, phone/Firebase authentication |
| Patient Administration | `patients`, `patient_types`, tương lai appointment/reception |
| Facility & Staffing | room type, room/runtime, device, doctor assignment |
| Service Catalog | Flow, FlowStep, dependency và version/publish tương lai |
| Encounter Runtime | Visit, VisitStep và dependency snapshot |
| Routing Core | RoutingQueue, VisitAssignment, VisitToken, routing decisions/strategies |
| Check-in & Queue | CheckInLog, RoomQueueEntry |
| Clinical | VitalSign, MedicalRecord/revision, Diagnosis, ClinicalOrder/Result, Attachment — chưa có |
| Pharmacy | Medication, Prescription/Item, Dispensation/Item — chưa có |
| Revenue | Invoice/Item, Payment, Refund — chưa có |
| Platform | ActivityLog, notification/preference, realtime, reports/export |
| Simulation | Production-integrated workflow simulator dùng làm regression harness; pure in-memory algorithm benchmark dùng cho thesis experiment/demo; không là production clinical source |

Logical ownership được giữ trong một MySQL database ở giai đoạn hiện tại. Module không được dùng repository nội bộ của domain khác làm API công khai mới.

## 5. Critical end-to-end workflows

### 5.1 Workflow hiện hoạt động

```text
Patient OTP/Firebase authentication
  -> xem service/Flow
  -> tạo Visit trực tiếp
  -> Visit graph được snapshot từ Flow
  -> root VisitStep READY
  -> routing chọn Room và tạo Assignment + VisitToken
  -> QR Device check-in đúng phòng
  -> RoomQueueEntry
  -> Doctor xác nhận ca/phòng, start exam
  -> Doctor complete exam
  -> giải phóng RoomRuntime và queue
  -> mở dependency tiếp theo
  -> event kích hoạt routing tiếp
  -> Visit hoàn tất khi workflow hiện hữu kết thúc
```

Backend và Patient/Admin UI bao phủ phần lớn đường đi này. Doctor UI vẫn chưa có workspace queue/start/complete hoàn chỉnh; hành trình toàn hệ thống chưa có browser E2E.

### 5.2 Workflow mục tiêu

```text
Patient registration
 -> Appointment
 -> Reception
 -> idempotent Visit creation
 -> existing routing/check-in/queue core
 -> Vital signs
 -> Doctor clinical record
 -> Clinical orders/results when needed
 -> Diagnosis + signed prescription
 -> Dispensation
 -> Invoice/payment
 -> independent completion policy
 -> published summary + follow-up appointment + notification
```

Appointment chỉ tạo đầu vào cho Visit. Clinical/finance module không được ghi trực tiếp bảng routing. Completion policy mở rộng sau routing, không thay thế hành vi hoàn thành hiện tại nếu chưa được duyệt.

## 6. Architectural invariants

1. Tiếp tục modular monolith; controller xử lý HTTP, service giữ nghiệp vụ, repository giữ persistence, DTO/mapper giữ contract.
2. Database hiện hữu là tài sản; migration mới additive/expand-first, không sửa migration đã chạy và không contract/drop khi chưa qua compatibility window.
3. Mỗi aggregate có một writer chính. Không dual-write đồng bộ hai kiến trúc song song.
4. Cross-domain integration dùng public application service/event contract; không tạo dependency repository mới xuyên module.
5. API list có pagination; aggregate/report tính ở backend, không tải toàn bộ về browser để đếm.
6. Multi-row mutation dùng transaction; thao tác dễ gửi lặp dùng idempotency/conditional write.
7. Signed clinical data và issued financial data bất biến; correction bằng revision/compensating record, không overwrite/delete.
8. Frontend chỉ dùng API thật, có loading/empty/error/retry/success/confirm phù hợp và không trình bày placeholder như chức năng hoàn chỉnh.
9. Socket/event hiện là delivery/invalidation; không được coi là durable source of truth.

## 7. Routing invariants — frozen core

Không tự ý thay đổi:

- cách Visit tạo VisitStep/dependency snapshot;
- transition `LOCKED -> READY` và cách dependency được resolve;
- strategy mặc định, candidate room, workload/ETA, tie-break và priority/FIFO;
- cách tạo RoutingQueue, VisitAssignment và VisitToken;
- QR check-in, RoomQueueEntry và ownership theo Device/Room;
- optimistic claim/release của RoomRuntime;
- Doctor start/complete và event mở bước kế tiếp;
- domain event `visit-step.ready`, `visit.updated`, `room-queue.updated`;
- semantics/state của Visit, VisitStep, Assignment, RoutingQueue, VisitToken, RoomQueueEntry và RoomRuntime;
- simulation behavior với cùng seed/config.

Frozen implementation boundary gồm `visits`, `routing`, `check-in`, `rooms/room-runtime.repository`, `doctor` và toàn bộ simulation regression harness. Các endpoint ad-hoc step, skip step và queue reorder là legacy exception surface, không phải extension point mẫu.

Manual room transfer, priority/emergency, recall/no-show, requeue, inserted step, cancelling routed step, doctor/room transfer hoặc shift handoff có active patient đều cần proposal riêng và approval trước code.

## 8. Security invariants

- Backend authorization là nguồn quyết định; menu visibility không phải security boundary.
- Deny by default; Patient chỉ own-resource; Staff clinical access phải có scope/care relationship trước khi mở rộng.
- Password/token/OTP/QR secret/clinical note/payment secret không vào response hoặc application log.
- Access token phải kiểm tra principal status và token version; refresh rotation/revoke chống replay.
- Sensitive read/write/sign/export/refund phải audit actor, action, resource, request/client context và reason khi cần.
- Audit metadata được schema hóa/redact; không sao chép payload y tế hoặc credential.
- Mutation cookie/BFF giữ CSRF origin defense; production yêu cầu HTTPS/Secure cookie.
- File, webhook, payment và external integration phải có authorization, validation, replay protection và idempotency trước khi mở.

### 8.1 Identity/RBAC semantics

Ba khái niệm dưới đây độc lập và không được dùng thay thế cho nhau:

- **`effectiveRoles`**: tập các role assignment hiện hành của một Staff. Đây là dữ liệu tổ chức/nhiệm vụ, không tự thân cho phép một hành động.
- **`effectivePermissions`**: hợp các permission được suy ra từ `effectiveRoles` hiện hành. Đây là cơ sở cho authorization backend, sau khi kết hợp resource scope, ownership/care relationship và trạng thái tài nguyên nếu use case yêu cầu.
- **Workspace/landing selection**: quyết định UX/navigation sau authentication. Preferred/primary workspace, nếu cần, chỉ là preference hoặc routing UX; nó không cấp role, không cấp permission và không phải authorization source.

Do đó: role không đồng nghĩa permission; permission không tự quyết định workspace. Backend luôn authorize bằng `effectivePermissions` cộng policy/scope liên quan, bất kể UI đã điều hướng người dùng đến workspace nào.

`users.role` tiếp tục chỉ là compatibility layer cho JWT, proxy và consumer legacy cho đến khi từng consumer được inventory, migrate và kiểm chứng an toàn. Nó không phải nguồn multi-role đích và không được âm thầm mở rộng thành “primary authorization role”. Việc contract hoặc thay đổi field này cần compatibility window, test lockout/privilege drift và rollback rõ ràng.

## 9. Capability status tại Slice 1H / FOUNDATION CLOSED

| Domain | Status | Bằng chứng/gap chính |
|---|---|---|
| Authentication | PARTIAL | Staff/Patient/Device auth, rotation, rate limit và token-version có; MFA, shared rate-limit store, full Patient v1 cutover chưa có |
| Authorization / RBAC | PARTIAL | Effective role/permission contract và permission guard có; workspace đã tách khỏi authorization; resource/facility/care scope chưa có; legacy `users.role` còn compatibility |
| Staff management | PARTIAL | Create/status/assign/revoke role, safe workspace landing, self-profile/password/session UI và atomic security mutation có; role-history view chưa hoàn chỉnh |
| Patient management | PARTIAL | OTP-created profile, Admin list/search/type update và Patient own profile có; merge/canonical identity/consent chưa có |
| Doctor management | PARTIAL | Account và shift/room assignment có; clinical worklist/workspace UI chưa hoàn chỉnh |
| Appointment / reception | NOT IMPLEMENTED | Patient hiện tạo Visit trực tiếp |
| Visit / encounter lifecycle | PARTIAL | Visit graph và happy path có; formal Encounter, cancellation/reopen/completion policy chưa có |
| Clinical workflow | NOT IMPLEMENTED | Chưa có vital/EMR/diagnosis/order/prescription |
| Room management | PARTIAL | CRUD/status/runtime có; maintenance drain và facility hierarchy chưa có |
| Queue management | PARTIAL | Queue/check-in/reorder có; concurrency/rebalance/exception policy còn nợ |
| Routing engine | COMPLETE (frozen baseline) | Happy path, retry, strategies và regression/simulation hiện hoạt động; production scale/outbox chưa hoàn thiện nhưng không được redesign ngầm |
| Workflow templates | PARTIAL | Flow DAG CRUD/UI có; immutable publish/version chưa có |
| Doctor scheduling / room assignment | PARTIAL | CRUD/confirm room có; concurrent overlap protection và history/effective dating chưa đủ |
| Nursing workflow | NOT IMPLEMENTED | Role tồn tại nhưng chưa permission/domain/UI |
| Laboratory | NOT IMPLEMENTED | Không có model/API/UI |
| Pharmacy | NOT IMPLEMENTED | Không có model/API/UI |
| Billing / cashier | NOT IMPLEMENTED | Không có model/API/UI |
| Notifications / realtime | PARTIAL | Socket invalidation backend có; persistent notification/read/preference và frontend integration chưa có |
| Audit | PARTIAL | Typed action catalog, bounded metadata denylist, auth/foundation mutation audit, patient/staff sensitive-read hook, effective-role actor context, query/retention contract có; immutable/tamper-evident storage, archive job và future domain coverage còn thiếu |
| Contract/regression harness | FOUNDATION COMPLETE | Critical Staff OpenAPI snapshot + generated frontend types, drift gate, role×endpoint/API matrix, browser Staff paths và isolated deterministic system-test boundary đã có; migration toàn bộ handwritten type không thuộc 1H |
| Simulation benchmark | COMPLETE (owner-approved exception) | Deterministic in-memory single/compare benchmark dùng trực tiếp production room-selection strategy implementations; không mô phỏng toàn bộ routing pipeline và không thay production routing configuration |
| Reporting / dashboard | PARTIAL | Admin dashboard cơ bản; metric definition/aggregate/filter/export chưa đủ |
| Device integration | PARTIAL | Device auth/manage/QR check-in có; attestation/offline/replay hardening chưa có |
| Patient application integration | PARTIAL | Web patient login/profile/service/Visit/QR có; external mobile source không nằm trong repo; clinical/appointment/finance portal chưa có |
| Inpatient/insurance/deep external HIS | OUT OF SCOPE pending approval | Có trong tài liệu target rộng nhưng không được xem là cam kết hiện hành |

### 9.1 Project-level Definition of Done

Approved thesis scope chỉ được xem là **feature-complete** khi đồng thời thỏa các điều kiện sau. Danh sách này định nghĩa mức hoàn thành cho scope đã được phê duyệt; nó không tự mở rộng scope hoặc đưa các non-goal vào dự án.

- Appointment → Reception → idempotent Visit handoff hoạt động end-to-end.
- Existing Visit routing, QR check-in và room queue workflow vẫn regression-safe, giữ nguyên routing semantics đã đóng băng.
- Nurse có thể ghi nhiều lần đo vital signs hợp lệ và Doctor xem được diễn biến.
- Doctor có thể tạo, hoàn tất/ký và điều chỉnh clinical documentation/diagnosis theo lifecycle đã duyệt.
- Clinical order/result hoạt động end-to-end trong phạm vi cận lâm sàng được approved.
- Doctor có thể phát hành prescription bất biến; Pharmacist có thể dispense đủ/thiếu/từ chối theo policy.
- Billing có thể tạo invoice và ghi nhận payment chính xác, idempotent và có reconciliation.
- Completion policy hoạt động quanh Visit hiện hữu mà không thay đổi routing semantics.
- Patient có thể xem published visit summary và follow-up information thuộc chính mình.
- Authorization và resource scope được enforce tại backend cho mọi actor tương ứng; UI không phải security boundary.
- Sensitive read/write/sign/dispense/payment/refund/export có audit phù hợp, đã redact và truy vết được.
- Critical API, integration và browser workflow có automated regression coverage, gồm happy path và deny/error path quan trọng.
- Migration và reconciliation chạy được từ supported clean baseline, có rollback/recovery boundary được kiểm chứng.
- Không còn placeholder hoặc control không hoạt động được trình bày như completed functionality.
- Không còn unresolved critical/high security hoặc data-integrity defect trong approved scope.
- Lint, type-check, production build và các regression suite liên quan đều xanh tại release candidate.

## 10. Phase 0 → Slice 1H review

| Milestone | Capability/dependency đã giải quyết | Debt/compatibility còn lại |
|---|---|---|
| Phase 0 / Slice 0 | Baseline, routing regression, health, request ID/redaction, CORS/Swagger, DB inventory/reconciliation/backup rehearsal, CI safety harness | Chỉ có bằng chứng local; production clone/RPO-RTO/observability và frontend E2E còn mở |
| Auth foundation trước 1A | HttpOnly BFF, token version, atomic refresh/OTP, rate limit, principal DB check | Legacy auth endpoint, in-process rate limit/single-flight, Patient endpoint cutover chưa hoàn tất |
| Slice 1A | Additive Role/Permission/RolePermission/UserRoleAssignment, backfill, permission guard, RBAC audit/API | `users.role` giữ compatibility; ADMIN fallback cho `rbac.manage`; custom role scope/history chưa chuẩn hóa |
| Slice 1B | Staff pagination và UI grant/revoke; last-role/last-admin guard | Danh sách đang lấy limit 100 ở UI; chưa có dedicated role-history projection |
| Slice 1C | Permission catalog và enforcement trên Staff business controllers | `RolesGuard` vẫn global; legacy role decorator/code còn tồn tại; resource-level scope chưa có |
| Slice 1D | Role nghiệp vụ mới, Staff create/status, initial assignment và audit transaction | Role mới mặc định deny và chưa có workspace; `users.role` vẫn bắt buộc/JWT claim |
| Slice 1E | Session `sid`, context, list/revoke UI/API | Session revoke chưa audit; `lastUsedAt` chỉ ghi lúc tạo/rotate; user-agent thô; profile page chưa edit profile/password |
| Slice 1F-A | Effective roles/permissions/session contract, workspace navigation độc lập và safe landing cho role chưa có workspace | `users.role`/JWT role/ADMIN fallback còn compatibility; chỉ ADMIN/DOCTOR có workspace; contract generation để 1H |
| Slice 1F-B | Self-profile/password/session UI; password hash + token-version increment + session revoke + audit cùng transaction; session mutations có audit redact | Role history chưa có; login/sensitive-read audit và audit policy platform để 1G; session `lastUsedAt`/device normalization còn nợ |
| Slice 1G | Audit action/resource catalog, metadata denylist, auth events, sensitive patient/staff read policy, effective-role context, deterministic query và retention contract | Không có automatic archive/delete, tamper evidence/SIEM; queue audit atomicity giữ nguyên vì routing core frozen; future domain action chỉ thêm khi domain tồn tại |
| Slice 1H | Critical Staff OpenAPI/generated-type PoC và drift gate; role×endpoint/API regression matrix; browser ADMIN/DOCTOR/safe-landing/deny paths; isolated deterministic system-test runner | Frontend types ngoài critical vertical còn handwritten; browser harness dùng deterministic API mocks; local full system test cần database `_e2e` riêng; mở rộng theo business slice thay vì platform rewrite |
| Simulation Benchmark exception | Pure in-memory thesis demo cho 3 dependency templates và 5 shared routing strategies; generated API contract và browser UI | Candidate projection/lifecycle là benchmark semantics, không phải full production routing equivalence; không persist result |

Không có TODO database migration đang failed tại local; 11 migration đã được áp dụng. Production migration sign-off vẫn mở.

## 11. Architecture drift checkpoint

### Drift/risks được phát hiện

1. **Dual authorization mechanism:** global `RolesGuard` và `PermissionsGuard` cùng tồn tại. Business controller đã chuyển phần lớn sang permission, nhưng `users.role`, JWT `role`, frontend proxy và ADMIN compatibility fallback vẫn là đường song song.
2. **Transitional `users.role`:** field này cần giữ để backward compatibility ngắn hạn, nhưng không được trở thành nguồn multi-role vĩnh viễn. Target là assignment/permission làm authorization source; một primary UI role có thể tồn tại riêng nếu business cần, không đồng nghĩa quyền.
3. **Frontend role/workspace compatibility:** generated critical session contract đã khóa role/session shape; chỉ ADMIN/DOCTOR có workspace hoàn chỉnh, role mới nhận safe landing và deny-by-default thay vì fallback sai.
4. **Versioning drift:** RBAC/session route dùng `/api/v1`, đa số domain endpoint vẫn legacy unversioned. Không tạo endpoint duplicate chỉ để đổi prefix; cần cutover plan theo domain.
5. **Module boundary debt:** routing/check-in/doctor/realtime/visits vẫn import repository xuyên module như baseline. Slice 1A–1E chưa làm xấu thêm routing, nhưng debt chưa được trả.
6. **Audit follow-up debt:** foundation audit policy đã thống nhất; immutable/tamper evidence, archival infrastructure và future business-domain coverage chỉ được thêm khi domain/topology tồn tại.
7. **State machine debt:** enum cancellation/reroute/processing tồn tại một phần nhưng use case không đầy đủ. Không tạo state machine thứ hai trong module mới.
8. **Contract migration debt:** critical Staff session/audit vertical đã dùng generated OpenAPI types và drift gate; các frontend contract còn lại vẫn handwritten và chỉ migrate incrementally khi business slice chạm tới.
9. **UI placeholder:** header global search và notification vẫn là affordance chưa có backend hoàn chỉnh.
10. **Transaction gaps legacy:** doctor shift overlap, queue ordering và một số state transitions còn check/write concurrency debt đã biết.

### Không phát hiện drift nghiêm trọng từ Slice 1A–1E

- Không có routing algorithm/state/schema bị copy hoặc thay đổi.
- RBAC/session schema đều additive; migration cũ không bị sửa.
- Business logic mới chủ yếu nằm service/repository, controller giữ HTTP concern.
- Không có parallel clinical/appointment/finance architecture được tạo sớm.

## 12. Roadmap hiện tại theo dependency

### Foundation closure

1. **1F-A — Identity/RBAC convergence (complete)**: effective-role/permission contract, workspace navigation tách biệt, safe landing và compatibility matrix.
2. **1F-B — Staff self-service closure (complete)**: profile/password, atomic session revoke, audit và UI/test.
3. **1G — Audit policy platform (complete)**: action catalog, metadata schema/redaction, sensitive-read hook, actor effective roles và retention/query contract.
4. **1H — Contract and E2E harness (complete)**: OpenAPI contract check/generated types PoC, Staff role×endpoint/API matrix, browser happy/deny regression và isolated fixture boundary.

```text
Slice 1F-A (complete)
  -> Slice 1F-B (complete)
  -> Slice 1G (complete)
  -> Slice 1H (complete)
  -> FOUNDATION CLOSED (2026-10-01)
  -> Slice 2A Appointment
```

Sau Slice 1H, không tự động thêm platform/foundation slice mới trước business roadmap. Foundation work chỉ được chen trước business slice kế tiếp khi **đồng thời** có concrete blocker được chứng minh từ implementation hiện tại, blocker không thể xử lý an toàn bên trong business slice, impact/dependency được document và owner phê duyệt. Modernization, cleanup hoặc infrastructure perfection tự thân không phải lý do trì hoãn core business workflow.

Simulation Benchmark hoàn tất ngày 2026-10-02 là exception tạm thời đã được owner phê duyệt cho thesis experiment/demo. Exception không mở lại Foundation: Production Workflow Simulator vẫn là regression harness, Pure Algorithm Benchmark là path in-memory riêng, routing core/default/candidate construction/transaction/state không đổi. Roadmap sau exception quay lại **Slice 2A Appointment Foundation**.

### Core business workflow

5. **2A — Appointment foundation**: schedule/slot/appointment state/history; chưa tạo Visit tự động.
6. **2B — Reception and idempotent Appointment→Visit handoff**: public Visits application service, duplicate prevention; routing core giữ nguyên.
7. **3A–3B — VitalSign backend + Nurse/Doctor UI**: append-only measurements tham chiếu Visit.
8. **4A–4C — MedicalRecord draft/sign/amend/publication**.
9. **5A–5C — Independent ClinicalOrder/result**; mọi tự động thêm routing step là slice riêng cần approval.
10. **6A–6C — Medication/prescription/dispensation**.
11. **7A–7C — Invoice/payment/refund**.
12. **8A–8B — Completion policy, summary và follow-up**, bao quanh routing completion hiện hữu.

### Supporting domains, integration, reporting, hardening

13. Persistent notification/preferences/realtime adapters được triển khai ngay trước domain event đầu tiên cần user-facing delivery, không nhất thiết đứng trước appointment.
14. Scoped dashboard/search/export sau khi các source domain ổn định.
15. Patient portal mở rộng theo từng dữ liệu đã publication, không xây màn hình rỗng trước domain.
16. Operational exceptions: một state proposal/slice, regression-first, approval nếu chạm routing.
17. Production hardening: shared rate limit/socket/outbox khi topology nhiều replica được xác nhận; security/E2E/performance/cutover.

## 13. Mandatory pre-slice checklist

Trước khi code, slice owner phải ghi lại:

- [ ] Đã đọc `docs/PROJECT_NORTH_STAR.md` và roadmap hiện tại.
- [ ] Đã inspect implementation, schema, migration, API và UI liên quan.
- [ ] Đã xác định domain owner và dependency bị ảnh hưởng.
- [ ] Đã xác định ảnh hưởng routing/state machine; nếu chạm frozen core, đã có approval.
- [ ] Đã xác định permission, resource scope, privacy và audit impact.
- [ ] Đã xác định migration/backfill/reconciliation/rollback impact.
- [ ] Đã xác nhận không có implementation tương đương hoặc parallel architecture.
- [ ] Đã định nghĩa actor, state transition, acceptance criteria và API/UI contract.
- [ ] Đã định nghĩa unit/integration/authorization/migration/regression test.
- [ ] Đã chốt rollback boundary và phần không thuộc scope.
- [ ] Slice vẫn có một reviewable rollback boundary. Nếu scope tăng đáng kể trong implementation hoặc không còn reviewable, phải dừng và đề xuất split thay vì tiếp tục mở rộng (ví dụ `1F-A`/`1F-B` cho convergence và self-service closure).

Sau khi hoàn thành:

- [ ] Prisma validate/generate và migration status sạch.
- [ ] Backend/frontend lint và type-check pass.
- [ ] Unit/integration/authorization test liên quan pass.
- [ ] Production build pass.
- [ ] DB reconciliation không có lỗi/cảnh báo mới.
- [ ] Routing/simulation regression pass khi backend/domain thay đổi.
- [ ] Critical E2E workflow liên quan đã được kiểm chứng.
- [ ] Architectural/routing/security invariants vẫn đúng.
- [ ] Slice report và North Star capability/roadmap được cập nhật nếu trạng thái đổi.
- [ ] Working tree được kiểm tra và commit có rollback boundary rõ.

## 14. Candidate slices đề nghị — chưa được phê duyệt triển khai

### Candidate A — 2A Appointment foundation (khuyến nghị tiếp theo, chưa được phê duyệt triển khai)

- Dependency: patient/service/staff foundation đã có; chưa cần sửa routing nếu chưa handoff sang Visit.
- Business value: bắt đầu hành trình bệnh viện mục tiêu thay vì tiếp tục platform-only.
- Risk: slot/capacity/schedule policy chưa được business owner quyết định.
- Modules: appointment mới, patient/service/doctor read ports, Patient/Reception UI.
- Acceptance: book/confirm/reschedule/cancel/history, overlap/capacity/idempotency và authorization; không tạo/ghi routing table.

### Candidate B — foundation follow-up debt (không tự động chen roadmap)

- Automatic archive/delete, tamper evidence, external SIEM và infrastructure retention job chỉ được đề xuất khi production topology/legal owner tồn tại.
- Queue mutation audit atomicity cần routing proposal riêng vì thuộc frozen core; không phải blocker để bắt đầu 2A.
- Migrate toàn bộ handwritten frontend contract hoặc mở rộng browser matrix không phải blocker cho 2A; thực hiện incrementally khi business slice tạo/chạm contract.

**Trạng thái:** Slice 1H hoàn tất và **FOUNDATION CLOSED**. Dừng trước Slice 2A; không tự động triển khai khi chưa có lệnh/phê duyệt tiếp theo và không tạo thêm Slice 1I/1J.
