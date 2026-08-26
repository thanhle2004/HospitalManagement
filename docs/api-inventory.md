# Inventory API, job và realtime

## Quy ước quyền

- **Public**: bỏ global Staff JWT.
- **Patient**: `@Public()` + Patient JWT guard.
- **Device**: `@Public()` + Device JWT guard.
- **Staff**: bất kỳ Staff JWT hợp lệ; không giới hạn role.
- **Admin/Doctor**: Staff JWT + role tương ứng.

API chưa có prefix/version (`/api/v1`), correlation ID, standardized pagination chung hoặc idempotency key.

## REST endpoint — 73 endpoint

| # | Method/path | Quyền | Request/validation chính | Hành vi/bảng chính |
|---:|---|---|---|---|
| 1 | GET `/` | Public | — | Hello/service info |
| 2 | POST `/auth/login` | Public | email, password | `users`, `refresh_tokens`; issue Staff token |
| 3 | POST `/auth/refresh` | Public | refreshToken | rotate `refresh_tokens` |
| 4 | POST `/auth/logout` | Staff | bearer | revoke all user refresh tokens |
| 5 | POST `/users/doctors` | Admin | email, password≥8, profile | create `users` + `user_profiles` |
| 6 | GET `/users/doctors` | Admin | — | list Doctor, no pagination |
| 7 | GET `/users/doctors/:id` | Admin | id string | read user; target role not asserted |
| 8 | PATCH `/users/doctors/:id/lock` | Admin | id string | set `users.status=LOCKED` |
| 9 | PATCH `/users/doctors/:id/unlock` | Admin | id string | set `ACTIVE` |
| 10 | GET `/users/me` | Staff | bearer | own profile |
| 11 | PATCH `/users/me` | Staff | optional profile fields | update `user_profiles` |
| 12 | POST `/users/me/change-password` | Staff | old/new password | update hash; session not revoked |
| 13 | POST `/patient-auth/register/request-otp` | Public | VN phone regex | create `patient_otps`; mock SMS |
| 14 | POST `/patient-auth/register/verify` | Public | phone, OTP, patient profile/type | create `patients`, consume OTP, issue session |
| 15 | POST `/patient-auth/login/request-otp` | Public | VN phone | create login OTP |
| 16 | POST `/patient-auth/login/verify` | Public | phone, OTP | consume OTP, issue session |
| 17 | POST `/patient-auth/refresh` | Public | refreshToken | rotate `patient_sessions` |
| 18 | POST `/patient-auth/logout` | Patient | bearer | revoke all patient sessions |
| 19 | GET `/patients/me` | Patient | bearer | own patient profile/type |
| 20 | POST `/patient-types` | Admin | code/name | create type |
| 21 | GET `/patient-types` | Staff | — | active types |
| 22 | GET `/patient-types/:id` | Staff | positive int | type detail |
| 23 | PATCH `/patient-types/:id` | Admin | optional fields | update type |
| 24 | DELETE `/patient-types/:id` | Admin | positive int | soft-delete |
| 25 | POST `/room-types` | Admin | name, avgProcessTime>0 | create type |
| 26 | GET `/room-types` | Staff | — | active types |
| 27 | GET `/room-types/:id` | Staff | positive int | type detail |
| 28 | PATCH `/room-types/:id` | Admin | optional fields | update type |
| 29 | DELETE `/room-types/:id` | Admin | positive int | soft-delete |
| 30 | POST `/rooms` | Admin | roomNumber/name/type/sort | create room + runtime transaction |
| 31 | GET `/rooms` | Staff | optional type/status | list rooms, no pagination |
| 32 | GET `/rooms/:id` | Staff | positive int | room detail |
| 33 | PATCH `/rooms/:id` | Admin | optional fields | update room |
| 34 | PATCH `/rooms/:id/status` | Admin | RoomStatus enum | update status |
| 35 | POST `/devices` | Admin | code/name/room/type | create device; return secret once |
| 36 | GET `/devices` | Admin | optional roomId | list devices |
| 37 | GET `/devices/:id` | Admin | UUID | device detail |
| 38 | PATCH `/devices/:id` | Admin | name/room/appVersion | update device |
| 39 | PATCH `/devices/:id/status` | Admin | DeviceStatus | enable/disable |
| 40 | POST `/devices/:id/regenerate-secret` | Admin | UUID | replace secret, return once |
| 41 | POST `/device-auth/login` | Public | code + secret | issue Device access token |
| 42 | POST `/doctor-assignments` | Admin | doctor/room/start/end | create shift after overlap check |
| 43 | GET `/doctor-assignments` | Staff | doctorId/roomId/activeOnly | list shifts |
| 44 | GET `/doctor-assignments/:id` | Staff | positive int | shift detail |
| 45 | PATCH `/doctor-assignments/:id/end` | Admin | positive int | set end now |
| 46 | DELETE `/doctor-assignments/:id` | Admin | positive int | hard delete |
| 47 | POST `/flows` | Admin | code/name/description | create flow |
| 48 | GET `/flows` | Staff | — | list active flows |
| 49 | GET `/flows/:flowId` | Staff | positive int | flow graph detail |
| 50 | PATCH `/flows/:flowId` | Admin | optional fields | update flow |
| 51 | DELETE `/flows/:flowId` | Admin | positive int | soft-delete flow |
| 52 | POST `/flows/:flowId/steps` | Admin | code/type/order/optional | create step |
| 53 | PATCH `/flows/:flowId/steps/:stepId` | Admin | optional step fields | update step |
| 54 | DELETE `/flows/:flowId/steps/:stepId` | Admin | ints | hard-delete step/dependencies |
| 55 | POST `/flows/:flowId/dependencies` | Admin | stepId != requiredStepId | add edge if DAG remains acyclic |
| 56 | DELETE `/flows/:flowId/dependencies/:stepId/:requiredStepId` | Admin | ints | delete edge |
| 57 | POST `/visits` | Patient | flowId | copy flow runtime, enqueue roots |
| 58 | GET `/visits/me` | Patient | bearer | own visits |
| 59 | GET `/visits/me/:id` | Patient | id | own visit graph/QR |
| 60 | GET `/visits` | Staff | — | all visits, no pagination |
| 61 | GET `/visits/:id` | Staff | id | any visit graph/QR |
| 62 | POST `/visits/:id/steps` | Doctor | roomTypeId, optional, dependsOn | add ad-hoc step |
| 63 | POST `/visits/:id/steps/:stepId/skip` | Doctor | IDs | skip optional LOCKED/READY step |
| 64 | POST `/routing/process-now` | Admin | — | poll/process routing queue |
| 65 | POST `/check-in` | Device | QR token | mark token/assignment/step, enqueue, log |
| 66 | GET `/doctor/queue` | Doctor | bearer | queues for on-duty rooms |
| 67 | POST `/doctor/visit-assignments/:id/start` | Doctor | assignment id | claim room, set in-progress |
| 68 | POST `/doctor/visit-assignments/:id/complete` | Doctor | assignment id | complete, dequeue, resolve successors |
| 69 | GET `/admin/queue` | Admin | — | full queue with patient PII |
| 70 | POST `/admin/queue/:id/move-to-front` | Admin | queue id | reorder + activity log |
| 71 | POST `/admin/queue/:id/move-after/:targetId` | Admin | two queue IDs | fractional reorder + log |
| 72 | GET `/activity-logs` | Admin | filters, page, limit≤100 | paginated audit read |
| 73 | GET `/health` | Public | — | DB health check |

## WebSocket

| Direction/event | Caller/recipient | Auth và payload | Ghi chú |
|---|---|---|---|
| Connect | Admin/Doctor/Patient | token trong `auth.token` hoặc query | Thử Staff secret rồi Patient secret; không check DB status |
| Client `doctor.refresh-rooms` | Doctor | không payload | Rejoin room theo ca trực hiện tại |
| Server `visit.updated` | Patient room | `{ visitId }` | Client phải refetch REST |
| Server `room-queue.updated` | Admin + Doctor room | `{ roomId }` | Client phải refetch REST |

Gateway dùng `origin: true, credentials: true`; frontend chưa khởi tạo socket.

## Cron và event nội bộ

| Trigger | Handler | Hành vi |
|---|---|---|
| `visit-step.ready` | `RoutingEngineService.assignRoom` | routing tức thời |
| Cron mỗi 10 giây | `processPendingQueue` | retry PENDING/FAILED dưới max attempts |
| `visit.updated` | `RealtimeGateway` | lookup patient rồi emit |
| `room-queue.updated` | `RealtimeGateway` | emit Admin/Doctor rooms |

Không có dead-letter UI, distributed lock, outbox hoặc persistent event history.
