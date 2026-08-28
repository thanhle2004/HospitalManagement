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
      health.controller.ts          # GET /health/live và /health/ready (public)
    patient-auth/                   # JWT Patient + xác minh Firebase Phone Authentication
      dto/                          # Firebase ID token, hoàn tất hồ sơ, refresh...
      guards/patient-jwt-auth.guard.ts    # KHÔNG global — gắn thủ công @UseGuards()
      strategies/patient-jwt.strategy.ts  # strategy tên 'patient-jwt', secret RIÊNG với Staff
      decorators/current-patient.decorator.ts
      repositories/                 # PatientOtpRepository cũ + PatientSessionRepository
      firebase-phone-auth.service.ts # xác minh Firebase ID token và phone_number
      patient-auth.service.ts       # login/register ticket / refresh / logout
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
Mỗi response thành công đi qua `TransformInterceptor`:
```json
{ "success": true, "statusCode": 200, "requestId": "...", "timestamp": "...", "data": { ... } }
```
Mỗi lỗi đi qua `AllExceptionsFilter`:
```json
{ "success": false, "statusCode": 404, "requestId": "...", "path": "/users/doctors/xxx", "timestamp": "...", "message": "..." }
```

### Health check
```
GET /health/live   → process liveness, không phụ thuộc database
GET /health/ready  → readiness có kiểm tra MySQL
GET /health        → alias tương thích của readiness
```

### Swagger / test API
Chạy `npm run start:dev` xong, mở trình duyệt:
```
http://localhost:3000/docs
```
Có nút **Authorize** (góc trên phải) để dán `accessToken` — sau đó test được tất cả route cần JWT ngay trên UI, không cần curl/Postman. Swagger mặc định tắt khi `NODE_ENV=production`; chỉ bật có chủ đích bằng `SWAGGER_ENABLED=true` sau reverse-proxy/VPN access control.

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

Mặc định tạo `admin@hospital.local` / `ChangeMe123!` (đổi qua `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` trong `.env` nếu muốn). Credential không được ghi ra log; **đổi mật khẩu ngay** sau khi login lần đầu qua `POST /users/me/change-password`.

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

## 7. Firebase Phone Authentication cho Patient

1. Trong Firebase Console, bật provider **Authentication → Sign-in method → Phone** và thêm domain frontend vào **Authorized domains**.
2. Điền cấu hình Web App `NEXT_PUBLIC_FIREBASE_*` ở frontend. Đây là cấu hình public dành cho trình duyệt, không phải service-account secret.
3. Backend luôn cần `FIREBASE_PROJECT_ID`, sau đó dùng một trong hai cách cấp quyền:
   - đặt `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới service-account JSON ở môi trường chạy; hoặc
   - điền thêm `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
4. Không commit service-account JSON hoặc private key thật vào repository.

Trình duyệt dùng Firebase SDK và invisible reCAPTCHA để gửi SMS. Sau khi bệnh nhân nhập đúng OTP, frontend lấy Firebase ID token rồi gửi qua BFF tới `POST /patient-auth/firebase/session`. Backend xác minh chữ ký, thời hạn token, `sign_in_provider=phone` và lấy `phone_number` trực tiếp từ token; số điện thoại trong request của trình duyệt không được tin cậy.

Nếu số điện thoại đã tồn tại, backend phát session Patient. Nếu chưa tồn tại, backend chỉ phát registration ticket ngắn hạn; bệnh nhân hoàn tất hồ sơ rồi mới được tạo tài khoản và session. Các endpoint OTP tự quản lý cũ vẫn được giữ tạm thời để tương thích, nhưng giao diện Patient không gọi chúng.

### Cơ chế Auth Patient
- **Token hoàn toàn tách biệt Staff**: strategy Passport riêng tên `'patient-jwt'`, secret riêng (`JWT_PATIENT_ACCESS_SECRET`/`JWT_PATIENT_REFRESH_SECRET`) — token Staff không dùng được cho route Patient và ngược lại, kể cả khi cả hai đều là JWT hợp lệ.
- **Không phải global guard**: `PatientJwtAuthGuard` chỉ gắn thủ công ở route cần (`/patients/me`, `/patient-auth/logout`) vì phần lớn route trong app là dành cho Staff. Toàn bộ `PatientAuthController`/`PatientsController` đều có `@Public()` ở mức class để guard riêng của Patient xử lý.
- **Xác minh số điện thoại**: Firebase gửi SMS và xác minh OTP; backend chỉ nhận Firebase ID token, kiểm tra token đã bị thu hồi và chỉ chấp nhận provider `phone` có claim `phone_number` hợp lệ.
- **Chống lạm dụng**: Firebase reCAPTCHA bảo vệ bước gửi SMS; endpoint đổi Firebase token thành session còn được rate-limit theo IP và số điện thoại.
- **Đăng ký an toàn**: registration ticket được ký bằng secret dẫn xuất riêng và không dùng được như Patient access token.

## Xem dữ liệu bằng Prisma Studio

```powershell
npm run prisma:studio
```

## Testing và safety gate

Unit/characterization test hiện không cần database; DB smoke/reconciliation chạy riêng trên MySQL:

```powershell
npm test              # chạy 1 lần
npm run test:ci       # deterministic, run-in-band cho CI
npm run test:watch    # chạy lại tự động khi sửa file
npm run test:cov      # kèm coverage report
npm run typecheck
npm run lint
```

Đã test:
- `graph.util.ts` — `topologicalSort` (Kahn's algorithm), `wouldCreateCycle`, `findReadyNodes`: chuỗi tuyến tính, node độc lập, đúng ví dụ trong spec §6 (A→C, B→E, D), phát hiện cycle trực tiếp/gián tiếp, multi-dependency (1 node chờ ≥2 tiền nhiệm)
- `generate-otp.util.ts` — đúng độ dài, không lặp cố định
- request-id validation và sensitive-text redaction
- Staff login/token persistence
- Visit create/copy flow/initial routing queue
- QR check-in transaction
- Doctor start-exam transaction/room claim

Tổng local hiện tại: **8 suites, 31 tests**. GitHub Actions còn chạy Prisma validate/migration/drift/reconciliation, build và `/health/live` + `/health/ready` smoke.

## Database safety

```powershell
npm run db:inventory       # metadata + count, không đọc row data
npm run db:reconcile       # 20 invariant checks
npm run db:drift:check     # live schema vs Prisma, read-only
npm run db:baseline:draft  # sinh draft SQL; không apply/resolve migration
npm run db:backup          # backup + SHA-256 + count manifest
```

Không replay hai migration lịch sử lên database legacy/production có sẵn. Xem `prisma/baseline/README.md` và `../docs/slice-0-implementation.md`.

## Docker (Phase 11)

```powershell
Copy-Item .env.example .env
# → đặt MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD và DATABASE_URL_DOCKER

docker compose up -d mysql
docker compose --profile operations run --rm migrate
docker compose up -d app
```

Migration là job riêng có approval; API **không** tự chạy migration lúc startup. Server chạy tại `http://localhost:3000`; Swagger chỉ có khi `SWAGGER_ENABLED=true`.

**Chỉ cần MySQL, chạy code trên máy host (dev có hot-reload)?**
```powershell
docker compose up -d mysql
npm run start:dev
```

Xem `Dockerfile` và service `migrate` trong `docker-compose.yml` để biết ranh giới deploy.

## Design pattern áp dụng
- **Repository Pattern** — mọi câu gọi Prisma nằm trong `*.repository.ts`. Service không import `PrismaService.<model>` trực tiếp.
- **Mapper Pattern** — `UsersMapper`/`PatientsMapper` loại bỏ field nhạy cảm (`passwordHash`) trước khi trả ra ngoài, dù entity Prisma có field này.
- **Unit of Work** (`prisma.service.ts` → `transaction()`) — `POST /users/doctors` tạo `User`+`UserProfile`; hoàn tất đăng ký Patient tạo hồ sơ + session; `VisitsService.create()` copy Flow→VisitStep; `DoctorService.completeExam()` — đều trong cùng 1 transaction.
- **Guard-based RBAC** — `JwtAuthGuard`+`RolesGuard` (Staff) đăng ký global qua `APP_GUARD`, secure-by-default. `PatientJwtAuthGuard`/`DeviceJwtAuthGuard` KHÔNG global, gắn thủ công theo route — 3 hệ thống JWT hoàn toàn tách biệt, không dùng lẫn được.
- **Firebase Phone Authentication** — Firebase Web SDK gửi/xác minh OTP; Firebase Admin SDK xác minh ID token trước khi backend phát session nội bộ.
- **Event-driven** (`@nestjs/event-emitter`) — `VisitsService`/`RoutingEngineService`/`CheckInService`/`DoctorService`/`AdminQueueService` không import lẫn nhau, chỉ emit event (`visit-step.ready`, `visit.updated`, `room-queue.updated`) — `RoutingEngineService` và `RealtimeGateway` lắng nghe, tránh circular dependency.
- **Optimistic Locking** — `RoomRuntime.version`, dùng khi Doctor "start exam" (chống 2 request cùng claim 1 phòng).
- **Fractional Ordering** — `RoomQueueEntry.position` kiểu `Float`, Admin chèn giữa hàng đợi bằng trung điểm 2 vị trí lân cận, không cần re-index toàn bộ.

## Roadmap các Phase
1. ~~Auth Staff (Admin/Doctor) + JWT Guard~~ ✅
2. ~~Auth Patient (Firebase Phone Authentication)~~ ✅
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
- Cấp production schema-only dump/anonymized clone để lặp lại inventory, reconciliation và restore rehearsal.
- Hoàn tất authorization/E2E/concurrency test còn thiếu.
- Bổ sung Firebase App Check và shared rate-limit store trước khi scale nhiều backend replica.
- Xử lý dependency advisory qua kế hoạch upgrade riêng có regression test.
