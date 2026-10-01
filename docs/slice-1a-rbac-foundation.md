# Slice 1A — RBAC foundation

Ngày triển khai local: **2026-10-01**  
Baseline: commit `80d3e74`.

## Phạm vi

Slice này thêm nền tảng permission và multi-role theo hướng additive. Trường enum `users.role` được giữ nguyên để tương thích auth/JWT và các `@Roles()` hiện hữu. Không thay đổi routing schema, state, strategy, event hoặc repository.

## Database

Migration `20261001090000_rbac_foundation` thêm:

- `roles`;
- `permissions`;
- `role_permissions`;
- `user_role_assignments`.

Migration seed role hệ thống `ADMIN`, `DOCTOR`, permission `rbac.manage`, cấp permission này cho ADMIN và backfill mỗi user hiện hữu sang assignment tương ứng với `users.role`.

Migration ban đầu phát hiện lỗi collation tại câu backfill trên MySQL local. Bốn bảng mới được tạo dở đã được xóa có kiểm soát, migration được đánh dấu rolled back, câu join được sửa bằng conversion/collation tường minh và deploy lại thành công. Không bảng/dữ liệu legacy nào bị xóa hoặc sửa trong quá trình repair.

Kết quả local sau backfill: 46 users, 46 assignments; ADMIN 1, DOCTOR 45.

## Backend

- `Permissions` decorator và global `PermissionsGuard`.
- Permission được đọc từ database ở request time, nên grant/revoke có hiệu lực ngay.
- Compatibility fallback chỉ cho `ADMIN -> rbac.manage`, tránh lockout nếu deployment chuyển tiếp chưa backfill xong; fallback không cấp wildcard permission.
- API:
  - `GET /api/v1/permissions?page=&limit=`;
  - `GET /api/v1/roles?page=&limit=`;
  - `POST /api/v1/roles`;
  - `PATCH /api/v1/roles/:id`;
  - `GET /api/v1/staff/:userId/roles`;
  - `POST /api/v1/staff/:userId/roles`;
  - `DELETE /api/v1/staff/:userId/roles/:roleCode`.
- Grant dùng upsert để chống gửi lặp. Revoke không cho nhân viên mất role cuối cùng.
- Create/update/grant/revoke ghi audit trong cùng transaction, gồm reason khi thay đổi, request ID, IP, user-agent và metadata đã giới hạn trường.

## Frontend

- Trang `/admin/roles` dùng API thật để liệt kê role/permission và tạo role.
- Có loading, empty, error/retry, validation cơ bản, disabled state và success/error toast.
- Assignment API đã sẵn sàng; màn hình staff lifecycle và gán nhiều role theo từng nhân viên thuộc Slice 1B.

## Verification

| Gate | Kết quả |
|---|---|
| Prisma format/validate/generate | Pass |
| Migration deploy/status | Pass — 8 migrations, up-to-date |
| Local RBAC backfill | Pass — 46/46 users có assignment |
| Database reconciliation | Pass — 25 checks, 0 error, 0 warning |
| Backend lint/typecheck/build | Pass |
| Backend Jest | Pass — 41 suites, 298 tests |
| Frontend lint/typecheck/build | Pass — `/admin/roles` được build |
| Frontend unit tests | Pass — 3 tests |

## Routing impact

Không có thay đổi routing. Toàn bộ 298 test backend, gồm Visit, routing, check-in, Doctor, RoomRuntime và simulation, tiếp tục pass.

## Rollback

- Code rollback về commit `80d3e74` vẫn hoạt động vì schema mới additive và code cũ bỏ qua bốn bảng.
- Không drop bảng RBAC khi rollback code. Giữ dữ liệu assignment/audit để điều tra và triển khai lại.
- `users.role` vẫn là compatibility source cho endpoint cũ; chưa có contract migration.

## Phần tiếp theo

Slice 1B: staff lifecycle, màn hình gán/thu hồi nhiều role, lịch sử thay đổi quyền và chuyển các endpoint hiện hữu từ role check sang permission mapping theo từng nhóm có characterization test.
