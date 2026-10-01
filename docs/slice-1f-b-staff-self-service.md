# Slice 1F-B — Staff self-service closure

Ngày triển khai local: **2026-10-01**  
Baseline: Slice 1F-A commit `2d8894c`

## Phạm vi và rollback boundary

Slice hoàn tất Staff self-profile, password change, session management UI và audit cho các mutation liên quan. Rollback boundary gồm Users/Auth application service, module persistence session dùng chung và profile/security UI; không có schema/migration mới. Không đổi effective-access contract, workspace, routing core hoặc business domain.

## Review `stash@{0}`

- **REUSE AS-IS:** shape của frontend profile API client còn đúng và được đưa vào `features/auth/profile.ts`.
- **REUSE WITH MODIFICATION:** DTO validation, controller request context, profile/password UI và ý tưởng service transaction được thích nghi với North Star; UI được ghép với session UX hiện hữu, error/confirm state đầy đủ.
- **DISCARD:** method thu hồi RefreshToken trong UsersRepository vì tạo ownership/persistence path trùng; patch report/README cũ và implementation page nguyên khối không được áp dụng.

Stash được giữ nguyên để bảo toàn bằng chứng review.

## Backend và atomicity

- `StaffSessionPersistenceModule` export đúng một `RefreshTokenRepository` hiện hữu cho Auth và Users; không tạo writer thứ hai.
- Password change xác minh credential trước transaction. Password hash + token-version increment, revoke toàn bộ refresh session và `STAFF_PASSWORD_CHANGED` audit cùng một Prisma transaction.
- Profile update và `STAFF_PROFILE_UPDATED` audit cùng transaction.
- Logout-all, revoke-one và revoke-others ghi audit trong cùng transaction với session mutation; ownership luôn scope theo authenticated `userId`.
- Metadata chỉ chứa request ID, danh sách tên field hoặc count; không chứa password, token hay giá trị profile.
- DTO strict, giới hạn độ dài và từ chối password mới trùng password cũ.

Failure-injection test chứng minh lỗi session revoke hoặc audit được propagate khỏi transaction callback; Prisma rollback toàn bộ write trong transaction. Sai mật khẩu cũ không mở transaction.

## Frontend

- Profile/security page hỗ trợ chỉnh hồ sơ, đổi mật khẩu, list/revoke session, retry/error/loading/empty và confirm cho thao tác thu hồi.
- Sau password change thành công, mọi server session bị revoke và frontend xóa cookie/auth state rồi yêu cầu đăng nhập lại.
- Session user được merge với profile response nên giữ nguyên `effectiveRoles`, `effectivePermissions` và `workspace`.

## Authorization và invariants

Self-service endpoints vẫn dựa vào authenticated Staff principal/global JWT guard; không dùng workspace hoặc `users.role` làm authorization source. Session resource luôn bị scope bằng actor ID. Không sửa route, routing/state machine, effective-access resolver hoặc role semantics.

## Verification

- Focused Users/Auth transaction suite: 2 suites, 15 tests pass.
- Full backend regression: 43 suites, 325 tests pass.
- Frontend unit: 5/5 pass.
- Backend/frontend lint, type-check và production build: pass.
- Prisma validate/generate, migration status (11 migrations) và drift check: pass.
- DB reconciliation: 25 checks, 0 error, 0 warning; SHA-256 `f0e59aa66cc97a56968e33731581e506a03385d539f3c3510cec8302704a96d`.
- Routing/simulation unit regression pass. System smoke hoàn tất admin login và hai routing/check-in/start/complete steps, sau đó dừng ở Doctor login vì local fixture password không khớp `SYSTEM_TEST_DOCTOR_PASSWORD`; dữ liệu local không được tự ý reseed.

## Compatibility debt còn lại

- `users.role`, JWT `role`, global RolesGuard và narrow ADMIN fallback vẫn là compatibility debt đã biết.
- Login và sensitive-read audit, action catalog/schema/retention/effective-role actor context thuộc 1G.
- Session `lastUsedAt` chỉ cập nhật khi create/rotate; device/user-agent normalization chưa có.
- Contract frontend/backend vẫn viết tay; contract drift/E2E harness thuộc 1H.
- Role nghiệp vụ chưa có workspace vẫn giữ safe landing, không được cấp permission để phục vụ UI.

## Điều kiện để bắt đầu 1G

Owner phải phê duyệt 1G riêng; giữ transaction policy đã chốt, không đưa clinical/business workflow vào audit platform, không chạm routing core và không log PII/credential. Slice 1F-B dừng tại commit riêng này.
