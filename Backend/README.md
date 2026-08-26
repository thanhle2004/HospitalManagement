# HospitalManagement — Backend

Backend NestJS + Prisma + MySQL cho hệ thống tối ưu luồng khám chữa bệnh (patient flow / queue routing).

## Cấu trúc
```
src/
  common/
    decorators/
      public.decorator.ts          # @Public() — bỏ qua JwtAuthGuard cho route này
    filters/
      all-exceptions.filter.ts     # chuẩn hoá lỗi HTTP + lỗi Prisma (P2002, P2025, P2003...)
    interceptors/
      transform.interceptor.ts     # bọc response thành công: { success, statusCode, data }
  config/
    configuration.ts                # namespace config đọc từ .env
    validation.schema.ts            # Joi schema — app fail ngay khi start nếu thiếu env bắt buộc
  prisma/
    prisma.service.ts               # wrap PrismaClient + helper transaction() (Unit of Work)
    prisma.module.ts                # @Global module, export PrismaService
  modules/
    auth/                           # Phase 1 — JWT auth cho Admin/Doctor
      dto/                          # LoginDto, RefreshTokenDto, TokenResponseDto
      guards/                       # JwtAuthGuard (global), RolesGuard (global)
      decorators/                   # @Roles(...), @CurrentUser()
      strategies/jwt.strategy.ts
      repositories/refresh-token.repository.ts
      auth.service.ts               # login / refresh (có rotation) / logout
      auth.controller.ts            # POST /auth/login, /auth/refresh, /auth/logout
    users/                          # Phase 1 — Admin quản lý Doctor + self-service
      dto/
      users.repository.ts
      users.mapper.ts               # ẩn passwordHash khỏi mọi response
      users.service.ts
      users.controller.ts
    health/                         # health check qua @nestjs/terminus
      health.controller.ts          # GET /health (public)
    patient-auth/                   # Phase 2 — JWT auth cho Patient (phone + OTP)
      dto/                          # RequestOtpDto, VerifyRegisterDto, VerifyLoginDto...
      guards/patient-jwt-auth.guard.ts    # KHÔNG global — gắn thủ công @UseGuards()
      strategies/patient-jwt.strategy.ts  # strategy tên 'patient-jwt', secret RIÊNG với Staff
      decorators/current-patient.decorator.ts
      repositories/                 # PatientOtpRepository, PatientSessionRepository
      otp-sender.service.ts         # mock gửi SMS (log console) — thay bằng gateway thật sau
      utils/generate-otp.util.ts    # sinh OTP bằng crypto.randomInt (CSPRNG)
      patient-auth.service.ts       # request-otp / verify (register+login) / refresh / logout
      patient-auth.controller.ts    # POST /patient-auth/...
    patients/                       # Phase 2 — hồ sơ Patient (Admin CRUD đầy đủ sẽ ở Phase 3)
      patients.repository.ts        # export dùng chung cho patient-auth + các phase sau (Visit...)
      patients.mapper.ts
      patients.controller.ts        # GET /patients/me (self-service)
  app.module.ts                     # đăng ký JwtAuthGuard + RolesGuard làm global guard
  main.ts
prisma/
  schema.prisma         # toàn bộ domain: Auth, Patient, Room, Flow/Workflow (DAG), Visit runtime, Routing, Audit
  seed.ts                # tạo tài khoản Admin đầu tiên + PatientType mặc định "STANDARD"
```

### Response format
M��i response thành công đi qua `TransformInterceptor`:
```json
{ "success": true, "statusCode": 200, "timestamp": "...", "data": { ... } }
```
M��i lỗi đi qua `AllExceptionsFilter`:
```json
{ "success": false, "statusCode": 404, "path": "/users/doctors/xxx", "timestamp": "...", "message": "..." }
```

### Health check
```
GET /health   →  { "status": "ok", "info": { "database": { "status": "up" } }, ... }
```

### Swagger / test API
Chạy `npm run start:dev` xong, mở trình duyệt:
```
http://localhost:3000/docs
```
Có nút **Authorize** (góc trên phải) để dán `accessToken` — sau đó test được tất cả route cần JWT ngay trên UI, không cần curl/Postman.

### Validation bằng Zod
Toàn bộ DTO dùng `zod` schema + `createZodDto` (thư viện `nestjs-zod`), KHÔNG còn dùng `class-validator`/`class-transformer`:
```ts
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
}).strict();          // .strict() = lỗi 400 nếu client gửi field lạ

export class LoginDto extends createZodDto(LoginSchema) {}
```
- `ZodValidationPipe` đăng ký global qua `APP_PIPE` trong `app.module.ts` — mọi `@Body()`/`@Query()`/`@Param()` khai kiểu là 1 zod DTO sẽ tự động được validate.
- Swagger tự sinh schema trực tiếp từ zod schema nhờ `patchNestJsSwagger()` gọi trong `main.ts` — **không cần** viết `@ApiProperty()` thủ công cho từng field.
- Lỗi validate trả về mảng chi tiết theo field (`AllExceptionsFilter` đã xử lý riêng `ZodValidationException`):
```json
{
  "success": false,
  "statusCode": 400,
  "message": ["password: String must contain at least 8 character(s)"]
}
```
- `birthday` dùng `z.coerce.date()` — tự parse chuỗi từ client thành `Date`, service không cần tự gọi `new Date(...)` nữa.

## 1. Cài đặt

```powershell
npm install
```

## 2. Cấu hình database + JWT

```powershell
Copy-Item .env.example .env
```

Sửa `.env`:
```
DATABASE_URL="mysql://root:password@localhost:3306/hospital_management"
JWT_ACCESS_SECRET="<chuỗi random dài>"
JWT_REFRESH_SECRET="<chuỗi random khác>"
```

Tạo database trước (nếu chưa có), chạy trong MySQL client:
```sql
CREATE DATABASE hospital_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 3. Migration + generate Prisma Client

```powershell
npx prisma migrate dev --name init
```

## 4. Seed tài khoản Admin đầu tiên

Không có endpoint đăng ký Admin (đúng theo spec — chỉ Admin mới tạo được tài khoản Doctor), nên **bắt buộc** seed trước khi dùng:

```powershell
npm run prisma:seed
```

M��c định tạo `admin@hospital.local` / `ChangeMe123!` (đổi qua `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` trong `.env` nếu muốn). **Đổi mật khẩu ngay** sau khi login lần đầu qua `POST /users/me/change-password`.

## 5. Chạy server

```powershell
npm run start:dev
```

## 6. Test nhanh API Auth + Users (Phase 1)

```bash
# 1. Login bằng tài khoản Admin vừa seed
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.local","password":"ChangeMe123!"}'
# → { "data": { "accessToken": "...", "refreshToken": "..." } }

# 2. Dùng accessToken cho mọi request tiếp theo (thay <TOKEN>)
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer <TOKEN>"

# 3. Admin tạo tài khoản Doctor
curl -X POST http://localhost:3000/users/doctors \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email":"doctor1@hospital.local","password":"Doctor123!","fullName":"Bs. Nguyễn Văn A","phone":"0900000000"}'

# 4. Danh sách Doctor
curl http://localhost:3000/users/doctors -H "Authorization: Bearer <TOKEN>"

# 5. Khoá / mở khoá tài khoản Doctor (thay <DOCTOR_ID>)
curl -X PATCH http://localhost:3000/users/doctors/<DOCTOR_ID>/lock -H "Authorization: Bearer <TOKEN>"
curl -X PATCH http://localhost:3000/users/doctors/<DOCTOR_ID>/unlock -H "Authorization: Bearer <TOKEN>"

# 6. Refresh access token khi hết hạn
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'

# 7. Logout — revoke toàn bộ refresh token của user
curl -X POST http://localhost:3000/auth/logout -H "Authorization: Bearer <TOKEN>"

# 8. Đổi mật khẩu (self-service, dùng được cho cả Admin lẫn Doctor)
curl -X POST http://localhost:3000/users/me/change-password \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"oldPassword":"ChangeMe123!","newPassword":"NewPass123!"}'
```

### Cơ chế Auth (Phase 1)
- **Global guard** (`app.module.ts`): mọi route mặc định **yêu cầu JWT hợp lệ**. Route nào không cần đăng nhập → gắn `@Public()` (đã áp dụng cho `/auth/login`, `/auth/refresh`, `/health`, `/`).
- **Phân quyền**: gắn `@Roles(UserRole.ADMIN)` trên route/method — không gắn `@Roles` nghĩa là mọi user đã đăng nhập (bất kỳ role) đều vào được (dùng cho `/users/me`...).
- **Refresh token rotation**: mỗi lần gọi `/auth/refresh`, token cũ bị revoke ngay lập tức và token mới được cấp. Nếu 1 refresh token bị lộ và dùng lại sau khi đã rotate → request sẽ fail (đã bị revoke).
- **Mật khẩu**: hash bằng `bcryptjs` (pure JS, không cần build native trên Windows), 10 salt rounds.

## 7. Test nhanh API Patient Auth (Phase 2)

OTP được **log ra console** của server (chưa nối SMS gateway thật — xem `otp-sender.service.ts`), copy mã từ log terminal ra dùng.

```bash
# 1. Đăng ký — bước 1: gửi OTP
curl -X POST http://localhost:3000/patient-auth/register/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"0912345678"}'
# → xem log server: "[MOCK SMS] Gửi OTP "123456" tới số điện thoại 0912345678"

# 2. Đăng ký — bước 2: xác thực OTP + cung cấp hồ sơ cá nhân (thay 123456 bằng mã thật từ log)
curl -X POST http://localhost:3000/patient-auth/register/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"0912345678","otp":"123456","fullName":"Nguyễn Văn A","address":"TP.HCM"}'
# → { "data": { "accessToken": "...", "refreshToken": "..." } }
# patientTypeId không truyền → tự gán PatientType mặc định "STANDARD" (đã seed)

# 3. Xem hồ sơ của chính mình
curl http://localhost:3000/patients/me -H "Authorization: Bearer <PATIENT_ACCESS_TOKEN>"

# 4. Đăng nhập lần sau — chỉ cần OTP, không cần lại thông tin cá nhân
curl -X POST http://localhost:3000/patient-auth/login/request-otp \
  -H "Content-Type: application/json" -d '{"phone":"0912345678"}'

curl -X POST http://localhost:3000/patient-auth/login/verify \
  -H "Content-Type: application/json" -d '{"phone":"0912345678","otp":"654321"}'

# 5. Refresh / Logout tương tự Auth Staff
curl -X POST http://localhost:3000/patient-auth/refresh \
  -H "Content-Type: application/json" -d '{"refreshToken":"<PATIENT_REFRESH_TOKEN>"}'

curl -X POST http://localhost:3000/patient-auth/logout \
  -H "Authorization: Bearer <PATIENT_ACCESS_TOKEN>"
```

### Cơ chế Auth Patient (Phase 2)
- **Token hoàn toàn tách biệt Staff**: strategy Passport riêng tên `'patient-jwt'`, secret riêng (`JWT_PATIENT_ACCESS_SECRET`/`JWT_PATIENT_REFRESH_SECRET`) — token Staff không dùng được cho route Patient và ngược lại, kể cả khi cả hai đều là JWT hợp lệ.
- **Không phải global guard**: `PatientJwtAuthGuard` chỉ gắn thủ công ở route cần (`/patients/me`, `/patient-auth/logout`) vì phần lớn route trong app là dành cho Staff. Toàn bộ `PatientAuthController`/`PatientsController` đều có `@Public()` ở mức class để "né" `JwtAuthGuard` (Staff, global) trước, rồi guard riêng của Patient mới xử lý tiếp.
- **OTP**: sinh bằng `crypto.randomInt` (CSPRNG, không dùng `Math.random()`), hash bằng `bcryptjs` trước khi lưu DB (không lưu plaintext) — giống cách xử lý password.
- **Chống spam**: cooldown 60s giữa 2 lần gửi OTP cùng số điện thoại (`OTP_RESEND_COOLDOWN_SECONDS`), giới hạn 5 lần thử sai (`OTP_MAX_ATTEMPTS`) trước khi phải xin mã mới.
- **Unit of Work**: `verifyRegister()` tạo `Patient` + đánh dấu OTP đã dùng trong cùng transaction — nếu tạo Patient lỗi, OTP vẫn còn hiệu lực để thử lại thay vì bị "đốt" vô ích.
- **Luồng đăng ký vs đăng nhập tách biệt** qua `OtpPurpose` (`REGISTER`/`LOGIN`) — 1 số điện thoại chưa có Patient sẽ bị chặn ở luồng login (gợi ý đăng ký), và ngược lại số đã có Patient bị chặn ở luồng register (gợi ý đăng nhập).

## Xem dữ liệu bằng Prisma Studio

```powershell
npm run prisma:studio
```

## Testing (Phase 11)

Unit test cho các thuật toán lõi — thuần TypeScript, KHÔNG cần database, chạy được ngay cả khi chưa `prisma generate`:

```powershell
npm test              # chạy 1 lần
npm run test:watch    # chạy lại tự động khi sửa file
npm run test:cov      # kèm coverage report
```

Đã test:
- `graph.util.ts` — `topologicalSort` (Kahn's algorithm), `wouldCreateCycle`, `findReadyNodes`: chuỗi tuyến tính, node độc lập, đúng ví dụ trong spec §6 (A→C, B→E, D), phát hiện cycle trực tiếp/gián tiếp, multi-dependency (1 node chờ ≥2 tiền nhiệm)
- `generate-otp.util.ts` — đúng độ dài, không lặp cố định

Đây là 2 file **duy nhất** trong toàn bộ project chạy full test được ở môi trường mình build project này — mọi phần còn lại phụ thuộc `@prisma/client` đã generate nên chỉ verify được bằng `tsc --noEmit`, chưa chạy runtime thật. Bạn nên bổ sung thêm test cho các Service khác (dùng `@nestjs/testing` + mock Repository) khi có điều kiện chạy trên máy có mạng.

**Lưu ý về `npm run test:cov`:** lệnh này cố gắng instrument (đo coverage) TOÀN BỘ file trong `src/`, kể cả những file chưa có test — nên nếu chạy ở môi trường chưa `prisma generate` được, bạn sẽ thấy lại đúng các lỗi cascading quen thuộc (`Module '@prisma/client' has no exported member...`) xuất hiện trong log, dù 19/19 test **vẫn pass bình thường** (2 dòng `Test Suites: 2 passed` / `Tests: 19 passed` ở cuối log mới là kết quả thật). Trên máy bạn (đã `prisma generate` xong) sẽ không gặp vấn đề này.

## Docker (Phase 11)

```powershell
Copy-Item .env.example .env
# → sửa các secret trong .env như bình thường (DATABASE_URL không cần sửa,
#   docker-compose.yml tự ghi đè để trỏ đúng service "mysql" trong mạng Docker)

docker-compose up --build
```

Lên đầy đủ 2 container: `mysql` (data lưu ở volume `mysql_data`, healthcheck trước khi cho `app` start) và `app` (tự chạy `prisma migrate deploy` rồi mới start server). Server chạy tại `http://localhost:3000`, Swagger tại `http://localhost:3000/docs`.

**Chỉ cần MySQL, chạy code trên máy host (dev có hot-reload)?**
```powershell
docker-compose up mysql -d
npm run start:dev
```

Xem `Dockerfile` để biết chi tiết — multi-stage build, có ghi chú rõ trade-off giữa việc copy nguyên `node_modules` (kèm `prisma` CLI để chạy migration lúc container start) so với bản "chỉ cài production deps" gọn hơn nhưng thiếu CLI.

## Design pattern áp dụng
- **Repository Pattern** — mọi câu gọi Prisma nằm trong `*.repository.ts`. Service không import `PrismaService.<model>` trực tiếp.
- **Mapper Pattern** — `UsersMapper`/`PatientsMapper` loại bỏ field nhạy cảm (`passwordHash`) trước khi trả ra ngoài, dù entity Prisma có field này.
- **Unit of Work** (`prisma.service.ts` → `transaction()`) — `POST /users/doctors` tạo `User`+`UserProfile`; `POST /patient-auth/register/verify` tạo `Patient` + đánh dấu OTP đã dùng; `VisitsService.create()` copy Flow→VisitStep; `DoctorService.completeExam()` — đều trong cùng 1 transaction.
- **Guard-based RBAC** — `JwtAuthGuard`+`RolesGuard` (Staff) đăng ký global qua `APP_GUARD`, secure-by-default. `PatientJwtAuthGuard`/`DeviceJwtAuthGuard` KHÔNG global, gắn thủ công theo route — 3 hệ thống JWT hoàn toàn tách biệt, không dùng lẫn được.
- **Strategy-ready** — `OtpSenderService` tách riêng thành 1 provider độc lập, chỉ cần thay nội dung 1 file khi tích hợp SMS gateway thật.
- **Event-driven** (`@nestjs/event-emitter`) — `VisitsService`/`RoutingEngineService`/`CheckInService`/`DoctorService`/`AdminQueueService` không import lẫn nhau, chỉ emit event (`visit-step.ready`, `visit.updated`, `room-queue.updated`) — `RoutingEngineService` và `RealtimeGateway` lắng nghe, tránh circular dependency.
- **Optimistic Locking** — `RoomRuntime.version`, dùng khi Doctor "start exam" (chống 2 request cùng claim 1 phòng).
- **Fractional Ordering** — `RoomQueueEntry.position` kiểu `Float`, Admin chèn giữa hàng đợi bằng trung điểm 2 vị trí lân cận, không cần re-index toàn bộ.

## Roadmap các Phase
1. ~~Auth Staff (Admin/Doctor) + JWT Guard~~ ✅
2. ~~Auth Patient (phone + OTP)~~ ✅
3. ~~Dữ liệu nền: RoomType, Room, PatientType, Device, DoctorAssignment~~ ✅
4. ~~Workflow Builder (Flow/FlowStep/FlowDependency) + thuật toán kiểm tra DAG~~ ✅
5. ~~Visit creation (copy Flow → VisitStep runtime) + Kahn's algorithm xác định bước READY~~ ✅
6. ~~Routing Engine (Greedy ETA selection)~~ ✅
7. ~~QR Check-in~~ ✅
8. ~~Doctor khám bệnh + điều chỉnh Workflow runtime~~ ✅
9. ~~Real-time (WebSocket) cho Admin/Doctor/Patient~~ ✅
10. ~~Giám sát & Audit (ActivityLog)~~ ✅
11. ~~Unit test thuật toán lõi + Docker~~ ✅ (Phase này — hoàn tất toàn bộ roadmap)

### Gợi ý cho bước tiếp theo (ngoài roadmap gốc)
- Test toàn bộ luồng thật trên máy có mạng (`prisma generate` chạy được) — sandbox lúc build project này bị chặn tải engine binary nên chưa chạy runtime thật được, chỉ verify bằng `tsc --noEmit` + unit test cho phần thuần logic.
- Bổ sung integration test (`@nestjs/testing` + database test riêng) cho các Service quan trọng: `RoutingEngineService`, `CheckInService`, `DoctorService`.
- SMS gateway thật thay `OtpSenderService` (đang mock, log ra console).
- CI/CD: GitHub Actions chạy `tsc --noEmit` + `npm test` + build Docker image mỗi lần push.
