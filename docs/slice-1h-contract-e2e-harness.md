# Slice 1H — Contract and E2E Harness

Ngày hoàn tất: **2026-10-01**
Trạng thái: **COMPLETE — FOUNDATION CLOSED**

## Boundary và inventory

Slice giữ nguyên business/routing semantics và chỉ thêm safety harness quanh capability Staff đã tồn tại. Inventory xác nhận backend dùng Nest Swagger + DTO/Zod, frontend còn nhiều type viết tay, BFF `/api/session` và `/api/backend/*` quản lý cookie/token, effective-access contract thuộc 1F, audit contract thuộc 1G, Jest/Node test đã có nhưng chưa có browser runner. System test cũ phụ thuộc credential database local và có thể gặp Doctor password stale do seed upsert không overwrite credential.

Không có API version rewrite, endpoint duplicate, permission expansion, fake workspace hoặc routing/schema mutation. Rollback boundary là một commit gồm contract PoC, regression harness, CI gate và documentation.

## Contract coverage

- Swagger creation được tách thành reusable `createOpenApiDocument` nhưng runtime setup không đổi.
- Snapshot `contracts/critical-staff.openapi.json` chỉ chứa hai critical vertical hiện hữu: current Staff session và audit history.
- Frontend generated artifact được tạo bằng `openapi-typescript`; auth role/workspace/status và activity-log base item thực sự derive từ generated schemas.
- Response envelopes và audit query pagination/filter được mô tả đúng trong OpenAPI.
- `npm run contract:check` regenerate rồi fail khi snapshot/generated type drift; CI chạy gate này.
- Phần còn lại của frontend types tiếp tục handwritten. Migration mở rộng phải theo từng business vertical, không generate toàn API trong 1H.

## Authorization/API regression matrix

Harness dùng controller và `PermissionsGuard` thật, deterministic principals/services và HTTP request pipeline có validation/response envelope.

| Principal | Current session | Audit history | Expected safety behavior |
|---|---:|---:|---|
| ADMIN | allow | allow | workspace ADMIN, permission contract giữ nguyên |
| DOCTOR | allow | deny | workspace DOCTOR, không tự cấp `audit.read` |
| ADMIN + DOCTOR | allow | allow | effective roles/permissions hợp nhất, workspace độc lập |
| NURSE chưa có business workspace | allow | deny | workspace `null`, deny-by-default |
| locked / disabled | deny | deny | principal status chặn trước capability |
| unauthenticated / invalid session | deny | deny | HTTP 401, không render Staff workspace |

Metadata tests đồng thời khóa permission annotations của RBAC, Staff, Doctor, ActivityLog và AdminQueue critical endpoints để phát hiện decorator drift.

## Browser/API E2E và fixture policy

- Playwright Chromium kiểm chứng ADMIN dashboard, DOCTOR no-shift page, safe landing cho role chưa có workspace, và unauthenticated deny/redirect.
- Browser network dùng deterministic same-origin session/backend mocks; không phụ thuộc developer database hoặc credential stale.
- Existing system-test có runner `test:system:isolated`: bắt buộc `E2E_DATABASE_URL`, suffix `_e2e`/`_test`, từ chối trùng developer DB ngoài ephemeral CI, reset/migrate/seed riêng rồi chạy API workflow.
- CI dùng database `hospital_management_test`, chạy contract drift, full Jest, isolated system test và Playwright. Không reseed/mutate developer database.

## Verification

- Backend focused harness: **3 suites / 29 tests pass**.
- Backend full regression including routing/simulation: **47 suites / 369 tests pass**.
- Frontend unit regression: **5 tests pass**.
- Playwright Chromium: **4 tests pass**.
- Backend/frontend lint and typecheck: pass.
- Backend/frontend production build: pass.
- Prisma schema validate, migration status (11 applied), drift check and DB reconciliation (25 checks, 0 errors, 0 warnings): pass.
- Prisma Client generation code path is unchanged; one local Windows retry remained blocked by an external file lock on `query_engine-windows.dll.node`. This is an environment lock rather than schema/generator failure and is recorded as verification debt until a clean-process rerun.

## Remaining debt and next gate

- Generated types cover a representative critical vertical, not the entire API.
- Browser tests intentionally cover only implemented Staff capability; Appointment/Clinical/Pharmacy/Billing workflows are not fabricated.
- Local full system E2E requires a separately provisioned `_e2e` database; CI owns the destructive ephemeral reset path.
- `users.role`, legacy JWT/`RolesGuard`, resource scope and other compatibility debt remain governed by the North Star; 1H does not alter them.

No concrete blocker meets the exception criteria for another foundation slice. Acceptance is sufficient to mark **FOUNDATION CLOSED**. The next roadmap item is **Slice 2A — Appointment foundation**, only after explicit approval.
