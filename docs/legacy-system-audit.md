# Khảo sát hệ thống hiện tại

## 1. Phạm vi, giả định, rủi ro và tiêu chí hoàn thành

### Phạm vi

- Đã đọc cây source gồm 192 file backend và 92 file frontend (không tính `node_modules`, build output).
- Đã phân tích `package.json`, cấu hình, entry point, controller/service/repository/DTO, Prisma schema, hai migration, seed, Docker, route/page và lớp gọi API frontend.
- Không đọc giá trị secret trong `.env`/`.env.local`; chỉ kiểm tra tên biến.
- Không kết nối MySQL thật, không chạy migration và không sửa code ứng dụng.

### Giả định

- `Backend/prisma/schema.prisma` là mô hình dữ liệu source-of-truth của code hiện tại.
- Hai file migration là toàn bộ migration history được cung cấp.
- Không có source riêng cho mobile Patient/Android scanner ngoài workspace.
- Không coi README là bằng chứng nếu code thực tế khác README.

### Giới hạn bằng chứng

- Không có dump MySQL, record count, query log, slow-query log, dữ liệu ẩn danh hay cấu hình production. Vì vậy không thể xác nhận view/procedure/trigger/event đang tồn tại ngoài source, orphan record, duplicate thực tế, collation/timezone hay dung lượng bảng.
- Workspace không có metadata Git ở root hoặc hai thư mục con, nên không thể xác định lịch sử thay đổi/owner/release tag.
- Unit test, type-check, lint và Prisma validation bị môi trường sandbox chặn ở `C:\Users\Admin\AppData`/`Temp` trước khi tool dự án chạy; các check bị treo đã được dừng. Không có claim “test pass” trong báo cáo này.

### Tiêu chí hoàn thành Phase 1

- Inventory stack, module, API, screen, DB, job/event/integration.
- Sơ đồ kiến trúc, dependency và ERD.
- Risk register, threat model, kiến trúc đích, ORM decision, ma trận mapping và kế hoạch migration.
- Danh sách câu hỏi cần duyệt; dừng trước triển khai.

## 2. Nhận diện hệ thống

### Backend

| Hạng mục | Hiện trạng |
|---|---|
| Runtime/framework | Node.js, NestJS 10.4, TypeScript 5.6 |
| API | REST controller + Swagger/OpenAPI tại `/docs`; chưa versioning |
| Database | MySQL qua Prisma 5.22; repository pattern không hoàn toàn kín |
| Validation | `nestjs-zod` + Zod global pipe |
| Auth | Ba miền JWT tách secret: Staff, Patient, Device |
| Async | `@nestjs/event-emitter`, cron 10 giây, Socket.IO gateway |
| Test | Jest/ts-jest; 2 suite, 19 test thuần thuật toán |
| Deploy | Dockerfile multi-stage; Docker Compose MySQL 8 + app |

Entry point: `Backend/src/main.ts` → `AppModule`. `AppModule` đăng ký 18 module nghiệp vụ/hạ tầng, global Zod pipe, Staff JWT guard và role guard.

### Frontend

| Hạng mục | Hiện trạng |
|---|---|
| Framework | Next.js 16.3 App Router, React 19.2, TypeScript strict |
| Rendering | Hầu hết page là Client Component; root redirect là Server Component |
| Server state | TanStack Query |
| Auth state | Zustand persist cả access/refresh token và user vào `localStorage` |
| Form | React Hook Form + Zod |
| UI | Tailwind CSS 4, Base UI/Radix và component local |
| Realtime | `socket.io-client` có dependency nhưng frontend chưa sử dụng |
| Test | Không có test config/file |

Entry point: `Frontend/src/app/layout.tsx`; `/` redirect `/login`. Staff admin dùng client-side `AuthGuard` và `StaffShell`.

## 3. Cấu trúc và kiến trúc tổng thể

Workspace có hai project độc lập (`Backend/`, `Frontend/`), mỗi project có `package-lock.json`; chưa phải monorepo, không có package contracts dùng chung và không có CI config.

Backend tổ chức theo module NestJS, nhưng ranh giới module chưa kín:

- `routing` import trực tiếp repository của `visits`, `rooms`, `room-types`.
- `check-in` import repository của `devices`, `routing`, `visits`.
- `doctor` import repository từ bốn module và gọi trực tiếp `VisitsService`.
- `realtime` đọc repository `visits` và `doctor-assignments`.
- `visits` đọc repository `flows` và `room-types`.

Đây là modular monolith về cách deploy nhưng chưa phải module boundary rõ theo domain/application port. Chi tiết ở [current-architecture.md](current-architecture.md).

## 4. Authentication và authorization

### Staff

- Login email/password, bcrypt cost 10.
- Access token mặc định 15 phút; refresh 7 ngày; refresh token được SHA-256 trước khi lưu.
- Refresh rotation có revoke token cũ; logout revoke mọi refresh token của user.
- Global Staff JWT guard bảo vệ mọi controller trừ `@Public()`.
- RBAC chỉ có `ADMIN` và `DOCTOR`.

Khoảng trống:

- JWT strategy chỉ tin payload, không kiểm tra user còn `ACTIVE`, chưa `deletedAt`, token version hay session revoke. User bị khóa vẫn dùng access token hiện tại đến hết hạn.
- `PATCH /users/doctors/:id/lock|unlock` không kiểm tra target có role Doctor; Admin biết UUID có thể đổi trạng thái user khác, kể cả Admin.
- Không revoke refresh token khi đổi mật khẩu hoặc khóa tài khoản.
- Không MFA, rate limit, brute-force lockout, password policy mạnh, bắt đổi mật khẩu lần đầu hay audit login.

### Patient

- Đăng ký/đăng nhập bằng OTP số điện thoại Việt Nam; OTP dùng CSPRNG và bcrypt.
- Access 30 phút; refresh 30 ngày; session lưu hash token, có rotation.
- Patient guard gắn thủ công trên route `@Public()`.

Khoảng trống:

- Mock sender log cả OTP plaintext và số điện thoại.
- Cooldown chỉ theo phone trong DB; không có rate limit theo IP/device/tenant.
- Hai request verify đồng thời có thể cùng pass trước khi `usedAt` được cập nhật vì consume OTP không phải conditional atomic update.
- Không chuẩn hóa `0...` và `+84...`, nên cùng một số người dùng có thể có hai định danh.
- Không có trạng thái khóa/consent/identity verification/record merge cho patient.

### Device

- Device login bằng code + secret, secret hash bcrypt, access token 12 giờ.
- Check-in yêu cầu Device JWT và device phải thuộc đúng phòng assignment.

Khoảng trống:

- Device bị tắt hoặc regenerate secret vẫn dùng access token cũ tới 12 giờ vì strategy không đọc trạng thái/version.
- Không mTLS/device attestation, nonce/replay protection hay rotation schedule.

## 5. API, background job, realtime và tích hợp

- 73 REST endpoint; inventory đầy đủ tại [api-inventory.md](api-inventory.md).
- Một cron mỗi 10 giây retry `RoutingQueue` ở `PENDING/FAILED` dưới số lần cho phép.
- Ba loại sự kiện nội bộ chính: `visit-step.ready`, `visit.updated`, `room-queue.updated`.
- WebSocket xác thực thủ công Staff/Patient JWT và phát tín hiệu invalidate: `visit.updated`, `room-queue.updated`.
- Không có webhook inbound/outbound.
- Tích hợp ngoài duy nhất được thiết kế là SMS, nhưng hiện là mock log; không có gateway thật.
- Không có upload/download file, ảnh, tài liệu hay hồ sơ bệnh án trong source.

## 6. Cấu hình và triển khai

- Backend validate các secret/database URL khi start; `.env.example` không chứa secret production nhưng có credential demo.
- Frontend dùng `NEXT_PUBLIC_API_URL` và `NEXT_PUBLIC_WS_URL`.
- `.env` và `.env.local` thật đang tồn tại trong workspace. Không có `.gitignore` ở root hoặc project; backend `.dockerignore` có loại `.env` khỏi image context.
- Docker Compose chứa credential MySQL development cố định và publish port 3306.
- Container app tự chạy `prisma migrate deploy` khi start. Cách này không đáp ứng yêu cầu phê duyệt migration production độc lập.
- Production image copy toàn bộ `node_modules`, gồm dev dependency/Prisma CLI.
- Không có CI/CD, staging config, backup job, monitoring, metrics, error tracking, readiness riêng hay runbook.
- README frontend nói đã bỏ Google font nhưng `src/app/layout.tsx` vẫn import `next/font/google`; tài liệu và code đã lệch.

## 7. Inventory màn hình

| Route | Vai trò | Mức độ |
|---|---|---|
| `/` | Public | Redirect tới `/login` |
| `/login` | Staff | Hoàn chỉnh cơ bản |
| `/admin` | Admin | Dashboard client-side, tổng hợp từ 6 API |
| `/admin/doctors` | Admin | List/create/lock/unlock |
| `/admin/doctor-assignments` | Admin | List/create/end/delete shift |
| `/admin/room-types` | Admin | CRUD (soft-delete) |
| `/admin/rooms` | Admin | Create/update/status |
| `/admin/devices` | Admin | Create/update/status/regenerate secret |
| `/doctor` | Doctor | Placeholder; chưa có queue/start/complete UI |

Sidebar có link disabled cho `/admin/queue`, `/admin/patients`, `/admin/flows`, `/admin/activity-logs`. Không có Patient portal, device UI, visit detail, flow builder, routing failure console hay audit search screen.

Mẫu chất lượng UI còn thiếu:

- Hầu hết table không hiển thị error state; không có pagination/filter/search thực.
- Search header, notification badge và profile menu là UI giả, chưa có hành vi.
- Sidebar ẩn ở màn hình dưới `md` nhưng không có mobile/tablet navigation thay thế.
- Không có `loading.tsx`, `error.tsx`, `not-found.tsx` theo route.
- Nhiều icon-only button thiếu accessible name ổn định; error form chưa nối `aria-describedby`.
- Password tạm thời của Doctor dùng input `type="text"`.

## 8. Nghiệp vụ được mô hình hóa nhưng chưa vận hành đầy đủ

- `VisitStatus.IN_PROGRESS` không được service chuyển tới; start exam chỉ cập nhật Assignment/Step. `CANCELLED` không có endpoint.
- `VisitStepStatus.CANCELLED`, `AssignmentStatus.CANCELLED`, `CancelReason`, `reroutedFromId` được schema hóa nhưng chưa có use case cancel/no-show/reroute.
- `RoutingStatus.PROCESSING` và method `markProcessing()` không được dùng.
- Activity log chỉ được ghi khi Admin `move-to-front` hoặc `move-after`; các thao tác nhạy cảm khác không audit.
- Socket frontend chưa kết nối dù backend gateway đã có.

## 9. Kết luận kiến trúc

Không có bằng chứng cho thấy cần thay toàn bộ nền tảng. Source hiện tại là prototype/modular monolith phù hợp làm baseline kỹ thuật, nhưng **không đủ phạm vi và kiểm soát để gọi là hệ thống quản lý bệnh viện production**. Nên ưu tiên:

1. Chụp inventory database thật và baseline an toàn.
2. Sửa kiểm soát bảo mật/authorization/audit và khóa state machine bằng test.
3. Đóng ranh giới module và tạo package contracts.
4. Hoàn thiện vertical slice patient-flow hiện hữu trước khi thêm EMR/lab/pharmacy/billing.
5. Chỉ triển khai module bệnh viện mới sau khi nghiệp vụ và ownership dữ liệu được duyệt.
