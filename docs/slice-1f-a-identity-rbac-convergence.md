# Slice 1F-A — Identity/RBAC convergence

Ngày triển khai local: **2026-10-01**  
Baseline: commit `08779ba`

## Phạm vi và rollback boundary

Slice này chỉ hội tụ contract identity/RBAC và workspace navigation. Không triển khai profile/password self-service (để lại cho 1F-B), không thêm permission nghiệp vụ, không thay auth flow/token format và không thay routing core.

Rollback boundary là response contract additive của `GET /api/v1/auth/sessions/current`, effective-access resolver và frontend navigation theo `workspace`. Rollback code không yêu cầu rollback database.

## Stash review

`stash@{0}` được review trước khi code:

- **REUSE AS-IS:** không có phần nào thuộc trực tiếp 1F-A.
- **REUSE WITH MODIFICATION:** ý tưởng frontend auth type/navigation được triển khai lại theo ba khái niệm độc lập; không apply patch cũ.
- **DISCARD cho 1F-A:** toàn bộ profile/password UI/service/repository/audit và report cũ vì thuộc 1F-B; stash vẫn được giữ để review lại ở 1F-B. Method thu hồi refresh token đặt trong UsersRepository không được dùng vì tạo persistence ownership trùng.

## Contract và semantics

Response Staff session hiện trả thêm:

- `effectiveRoles`: role code từ `UserRoleAssignment` hiện hành;
- `effectivePermissions`: hợp permission từ các assignment, đã loại trùng và sort;
- `workspace`: `ADMIN`, `DOCTOR` hoặc `null`.

`users.role` và JWT `role` không đổi. Chúng tiếp tục phục vụ compatibility cho consumer legacy; permission guard vẫn đọc assignment từ database tại request time. Workspace chỉ chọn UX/navigation và không cấp quyền.

Quy tắc chọn workspace:

1. Nếu legacy role ADMIN/DOCTOR vẫn có assignment tương ứng, giữ workspace đó.
2. Nếu không, chọn một workspace đã hoàn chỉnh từ effective roles: ADMIN trước, sau đó DOCTOR.
3. Legacy ADMIN/DOCTOR chưa backfill assignment vẫn giữ landing cũ để tránh lockout; authorization fallback vẫn chỉ hẹp như Slice 1A.
4. Role không có workspace hoàn chỉnh nhận `workspace=null` và được đưa tới `/workspace-unavailable`; không được cấp permission bổ sung.

## Backend

- `RbacService.getEffectiveAccess()` là một resolver dùng cùng assignment graph với permission guard; không tạo authorization architecture thứ hai.
- `GET /api/v1/auth/sessions/current` ghép DTO user an toàn với effective access.
- DTO Zod/Swagger mới mô tả contract additive.
- AuthModule import public `RbacModule`; không import repository nội bộ.

## Frontend

- Tách `StaffUser` legacy resource DTO khỏi `StaffSessionUser` có effective-access contract.
- Login/session bootstrap và AuthGuard điều hướng bằng `workspace`, không dùng primary/legacy role.
- Proxy chỉ làm optimistic authentication check; không còn tự suy diễn authorization/workspace từ JWT role.
- Admin/Doctor layout kiểm tra workspace; backend permission vẫn là security boundary.
- `/workspace-unavailable` hiển thị trạng thái an toàn cho role chưa có workspace và cho phép logout.

## Regression matrix

| Case | Kết quả |
|---|---|
| Existing ADMIN | ADMIN assignment/legacy compatibility chọn ADMIN; narrow fallback `rbac.manage` được giữ |
| Existing DOCTOR | DOCTOR assignment chọn DOCTOR; permission vẫn từ assignment |
| Multi-role Staff | Permission là union; workspace tách riêng và deterministic |
| Role mới chưa có workspace | `workspace=null`, không redirect sang Admin/Doctor, không permission ngầm |
| Disabled/locked Staff | JWT strategy từ chối trước khi tạo session context |
| Legacy JWT/version path | Token thiếu version chỉ hợp lệ khi DB version bằng 0 |
| Deny-by-default | Permission vắng mặt trả false; workspace không thay đổi kết quả |
| Escalation/lockout | Legacy ADMIN fallback chỉ áp dụng `rbac.manage`; legacy ADMIN/DOCTOR landing được bảo toàn khi backfill chưa đủ |

## Database và routing

- Không có schema/migration/backfill mới.
- 11 migration hiện hữu vẫn up-to-date.
- Không thay Visit, VisitStep, routing strategy, assignment/token, check-in, queue, RoomRuntime, Doctor transition, event hoặc simulation.

## Verification

- Focused backend matrix: 3 suites, 19 tests pass.
- Full backend regression: 43 suites, 320 tests pass.
- Backend Prisma validate, migration status, lint, typecheck, build: pass.
- Frontend lint, typecheck, 5/5 unit test và production build: pass; 29 routes gồm `/workspace-unavailable`.
- DB reconciliation: 25 checks, 0 error, 0 warning; SHA-256 `2ef4c0902209f07f5de3bdb97e173ad18aa258e57c560a6299f45caecbad4320`.
- Prisma generate: pass sau khi dừng các backend watcher giữ DLL; backend dev đã được khởi động lại với một watcher.

## Compatibility debt còn lại

- `users.role`, JWT `role` và global RolesGuard vẫn tồn tại; chưa được contract/drop.
- ADMIN compatibility fallback cho `rbac.manage` vẫn tồn tại đến khi production backfill được chứng minh.
- Chỉ ADMIN/DOCTOR có workspace; role nghiệp vụ khác phải chờ business UI tương ứng.
- Frontend proxy là optimistic authentication gate, không phải authorization gate.
- Backend/frontend contract vẫn viết tay; contract generation thuộc 1H.

## Điều kiện bắt đầu 1F-B

- Giữ nguyên effective-access/session contract của 1F-A.
- Không dùng `users.role` hoặc workspace làm authorization cho profile/password.
- Re-review stash, không dùng UsersRepository để sở hữu RefreshToken persistence trùng.
- Profile/password/session revoke phải có transaction, audit đã redact và test rollback/unauthorized path.
