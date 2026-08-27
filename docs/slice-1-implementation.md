# Slice 1 — Authentication, session và authorization foundation

Ngày triển khai local: **2026-08-27**
Trạng thái: **đã triển khai và kiểm chứng trên local; chưa phải production sign-off**.

## 1. Giả định tạm thời và phạm vi đã chốt

- Giữ nguyên hai role hiện hữu `ADMIN` và `DOCTOR`; không tự tạo role/quyền nghiệp vụ khi câu 8–13 trong `business-questions.md` chưa có owner phê duyệt.
- Khóa tài khoản/thiết bị, đổi mật khẩu và logout phải có hiệu lực ở request kế tiếp, không chờ access-token TTL.
- Staff web dùng Backend-for-Frontend cùng origin của Next.js. Access/refresh token chỉ nằm trong cookie `HttpOnly`, không còn persist trong `localStorage` và không xuất hiện trong JSON trả cho trình duyệt.
- Endpoint legacy cho Staff/Patient/Device vẫn được giữ để các client cũ không bị cắt hợp đồng.
- Rate limit Slice 1 dùng bộ đếm trong process, phù hợp topology modular monolith một replica hiện tại. Đây là gate bắt buộc phải thay bằng shared store trước khi scale nhiều replica.
- Permission table và màn hình quản lý role mới chưa được tạo vì matrix role/resource/facility/care-relationship chưa được duyệt.

## 2. Luồng Staff web mới

1. Trình duyệt gọi `POST /api/session` cùng origin Next.js.
2. Route Handler gọi `POST /api/v1/auth/sessions` ở backend, giữ token ở server và chỉ trả DTO user an toàn cho browser.
3. Hai cookie `hm_staff_access` và `hm_staff_refresh` được set với `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` ở production.
4. Các API browser đi qua `/api/backend/[...path]`; Route Handler gắn Bearer token ở server, rotate refresh khi cần và không forward endpoint có thể lộ Staff token.
5. `src/proxy.ts` kiểm tra cookie lạc quan trước khi render `/admin` hoặc `/doctor`. Backend JWT strategy vẫn query DB và kiểm tra status, role hiện tại, `tokenVersion` cho mọi quyết định bảo mật thật.
6. Mọi mutation vào BFF phải có `Origin` đúng bằng origin hiện tại. Cookie `SameSite=Lax` là lớp bổ sung chống CSRF.

`localStorage.staff-auth` của phiên bản cũ được xóa một lần khi app khởi động; Zustand chỉ giữ DTO user trong memory để render UI.

## 3. Backend/API và tương thích ngược

API Staff v1 mới:

| Method | Path | Mục đích |
|---|---|---|
| `POST` | `/api/v1/auth/sessions` | Login với phản hồi chống dò trạng thái account |
| `POST` | `/api/v1/auth/sessions/refresh` | Rotate refresh token atomic |
| `GET` | `/api/v1/auth/sessions/current` | Trả DTO Staff sau khi đối chiếu DB |
| `DELETE` | `/api/v1/auth/sessions/current` | Revoke toàn bộ phiên và tăng token version |
| `POST` | `/api/v1/patient-auth/otp-challenges` | Yêu cầu OTP với cùng response cho phone/purpose tồn tại hoặc không tồn tại |

Các route `/auth/*`, `/patient-auth/*` và `/device-auth/login` vẫn tồn tại. Staff login legacy vẫn giữ thông báo account locked cũ; API v1 trả cùng lỗi credential để giảm account enumeration.

## 4. Session/revoke và chống replay

- Thêm `token_version INT NOT NULL DEFAULT 0` cho `users`, `patients`, `devices`.
- Access JWT mới chỉ chứa subject, role nếu cần và token version; email/phone/device code không còn được nhúng vào token mới. Token legacy thiếu version được hiểu là version `0` để cutover không làm mất phiên đang hoạt động.
- Staff/Patient/Device JWT strategy đọc principal từ DB ở mỗi request. Status không active hoặc token version lệch đều trả `401`.
- Lock/unlock Staff, đổi mật khẩu, logout Staff/Patient, disable Device và regenerate Device secret đều tăng token version.
- Refresh token Staff/Patient mới có `jti` UUID để không trùng khi ký trong cùng một giây.
- Rotation dùng một `UPDATE ... WHERE hash = ? AND revoked_at IS NULL AND expires_at > NOW()` trong transaction. Tất cả hàng legacy trùng hash được revoke cùng lúc; request replay tiếp theo cập nhật `0` hàng và bị từ chối.
- OTP đúng được consume bằng conditional update trong cùng transaction với tạo Patient/session. Hai request verify đồng thời chỉ có một request cập nhật được `used_at`; request còn lại bị từ chối. Số lần thử sai cũng chỉ tăng khi OTP chưa dùng và chưa chạm giới hạn.

## 5. Rate limit xác thực

Identifier chỉ được giữ dưới dạng SHA-256 trong memory, không log email/phone/code/token.

| Luồng | Giới hạn identity | Giới hạn IP |
|---|---:|---:|
| Staff login | 5/phút | 20/phút |
| Staff/Patient refresh | 10/token/phút | 60/phút |
| Patient OTP request | 5/phone/10 phút | 20/10 phút |
| Patient OTP verify | 10/phone/10 phút | 30/10 phút |
| Device login | 10/code/phút | 30/phút |

`AUTH_RATE_LIMIT_ENABLED` mặc định `true`. Không được tắt ở production nếu chưa có compensating control được security owner duyệt.

## 6. Migration và bằng chứng dữ liệu local

Migration additive: `20260826183922_slice1_token_versions`.

```sql
ALTER TABLE `devices` ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `patients` ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 0;
```

Không có drop/rename, không đổi khóa và không cần backfill riêng vì default `0` bảo toàn token legacy.

| Bằng chứng | Kết quả |
|---|---|
| Pre-migration reconciliation | 20 checks, 0 error, 0 warning; SHA-256 `031bf5875e74274be6877e37163cc3b3dc54408152e0a084eb061f34a9906daa` |
| Pre-migration backup | 25 bảng; SHA-256 `de336279acf4ee663187f5b1999771b3d7c058b3fe4d140c0d541b0ca41ad164` |
| Migration status | 3 migration, up-to-date; schema drift bằng 0 |
| Final inventory | 25 bảng, 0 view/trigger/routine/event; SHA-256 `391008e23e601b35d484e76bed32d60c4d9c52a6ef2364b9553f7229eb1b2ba2` |
| Final reconciliation | 25 checks, 0 error, 0 warning; SHA-256 `43af9000b3757591b05639ec6d36bddadfe4ceb9a6c18010a75781570aa5152f` |

Đối soát Slice 1 bổ sung canonical Staff email, token version âm, active duplicate refresh hash Staff/Patient và active refresh của Staff không còn `ACTIVE`. Snapshot cuối: 4 users, 3 patients, 0 devices; không duplicate canonical email hoặc active token hash.

## 7. Verification local

| Gate | Kết quả |
|---|---|
| Backend lint/typecheck/build | Pass; hai build liên tiếp đều sinh `dist/main.js` |
| Backend Jest | 13 suites, 48/48 tests pass |
| Frontend lint/typecheck/build | Pass; 11 page route, 2 Route Handler động và Proxy được build |
| BFF login | `200`; JSON không có `accessToken`/`refreshToken` |
| Cookie | 2/2 có `HttpOnly`, `SameSite=Lax`, `Path=/` |
| Session/API proxy | `/api/session` và `/api/backend/users/me` đều `200` khi có cookie hợp lệ |
| CSRF smoke | Mutation có Origin ngoài allowlist trả `403` trước khi tới backend |
| Logout/revoke | Logout `204`; cookie cũ và access token cũ đều trả `401` ngay |
| Rate-limit smoke | 5 lần credential sai trả `401`, lần thứ 6 trả `429` |
| Refresh concurrency | 2 request đồng thời cùng refresh token đều nhận phiên đã coalesce; replay token cũ trực tiếp trả `401` |
| OTP anti-enumeration | Existing-phone/REGISTER và missing-phone/LOGIN cùng trả `202`, cùng success flag/message, không echo phone |
| Reconciliation/drift | 25/25 sạch; không schema drift |

## 8. Gate còn mở trước production

1. Chưa có clone ẩn danh/schema dump production; mọi bằng chứng DB trên chỉ thuộc MySQL local.
2. Role ngoài Admin/Doctor, scope theo facility/care relationship, break-glass và dual approval chưa được business/security owner quyết định.
3. Bộ đếm rate limit và single-flight refresh của BFF đang theo process. Trước nhiều replica cần shared rate-limit store và session/refresh coordination phù hợp topology.
4. Production bắt buộc HTTPS để cookie `Secure` hoạt động; reverse proxy, trusted origin/host và header forwarding cần smoke test trong staging thật.
5. Patient app/Device app chưa chuyển sang endpoint versioned; contract legacy vẫn được giữ. Patient v1 hiện mới version hóa bước tạo OTP challenge, chưa thay toàn bộ verify/refresh UI.
6. Admin role/permission screen được hoãn vì chưa có permission matrix được duyệt; màn hình quản lý Doctor hiện hữu vẫn dùng role cố định.
7. GitHub Actions, Docker runtime, dependency advisory và RPO/RTO vẫn là gate mở từ Slice 0.
8. Cần SMS sandbox/test sender để chạy Patient OTP E2E mà không ghi OTP vào log.

## 9. Rollback

- Legacy auth endpoints và cột/token tables cũ vẫn được giữ, nên mobile/device client hiện tại không phải cutover đồng thời.
- Nếu web BFF có sự cố, redeploy commit trước Slice 1 để quay về web adapter cũ trong rollback window. Việc này chỉ nên dùng như rollback khẩn cấp vì adapter cũ lưu token trong localStorage.
- Không chạy down migration để drop `token_version`. Ba cột additive có thể được code cũ bỏ qua, nên giữ lại an toàn hơn DDL phá hủy.
- Token đã tăng version trong lúc Slice 1 chạy có thể buộc người dùng đăng nhập lại sau rollback; không sửa version giảm xuống.
- Backup pre-migration chỉ dùng cho tình huống khôi phục thảm họa được DBA phê duyệt, không restore đè database chỉ để rollback code.
