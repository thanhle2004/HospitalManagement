# Ma trận chức năng hiện tại → kiến trúc đích

`Giữ` = bảo toàn hành vi sau characterization test; `Sửa` = refactor/hardening; `Mới` = chưa có trong source.

| Chức năng hiện tại/yêu cầu | Module đích | API đích gợi ý | Màn hình đích | Hành động |
|---|---|---|---|---|
| Staff login/refresh/logout | identity/auth | `/api/v1/auth/sessions` | `/login`, profile/security | Sửa token storage/revoke/rate limit |
| Admin/Doctor account | identity/users + authorization | `/api/v1/admin/users`, `/roles`, `/permissions` | `/admin/users`, `/admin/roles` | Mở rộng role/permission/scope, audit |
| Patient OTP | patient-identity | `/api/v1/patient-auth/otp-challenges` | `/patient/login`, `/patient/register` | Giữ luồng, sửa privacy/atomic/rate limit |
| Patient profile/type | patients + master-data | `/api/v1/patients`, `/patient-categories` | `/patients`, `/patients/[id]` | Tách category khỏi insurance/priority; merge/dedupe |
| Doctor shifts | staffing | `/api/v1/staffing/assignments` | `/staffing/shifts` | Sửa overlap concurrency/effective history |
| Room type/room/runtime | facilities | `/api/v1/facilities/rooms` | `/admin/rooms` | Thêm facility/department, drain/maintenance rule |
| QR scanner device | device-management | `/api/v1/devices`, `/device-sessions` | `/admin/devices` | Sửa token version/attestation/audit |
| Flow builder DAG | service-catalog/workflow | `/api/v1/workflows` | `/admin/workflows/[id]` | Giữ thuật toán; version/publish immutable definition |
| Visit runtime | encounters/workflow-runtime | `/api/v1/encounters` hoặc `/visits` | `/visits/[id]`, patient tracking | Chốt semantic Visit vs Encounter; hoàn thiện state |
| Greedy routing | routing | `/api/v1/routing/jobs`, internal worker | routing failures/admin console | Worker/outbox/lock/performance |
| QR check-in | reception/check-in | `/api/v1/check-ins` | scanner UI, reception console | Idempotency, audit, fallback manual |
| Room queue | queue-management | `/api/v1/queues` | `/queues`, doctor queue | Sequence/priority policy, privacy, realtime |
| Doctor start/complete | encounters | `/api/v1/encounters/{id}/transitions` | `/doctor/queue`, `/encounters/[id]` | Policy theo assignment, state machine/audit |
| Realtime invalidation | platform/realtime | socket namespace versioned | dashboard/doctor/patient | Shared adapter, reconnect/authorization |
| Activity log | platform/audit | `/api/v1/audit-logs` | `/audit-logs` | Bao phủ mutation/read nhạy cảm, immutable/retention |
| Dashboard | reporting/read-model | `/api/v1/dashboard/summary` | `/dashboard` | Server aggregate, timezone, permission scope |
| Appointments | appointments | `/api/v1/appointments` | `/appointments` | Mới |
| Reception/triage | reception | `/api/v1/receptions`, `/triage` | `/reception`, `/triage` | Mới, không đồng nhất với QR scan |
| Medical record/diagnosis | encounters/medical-records | `/api/v1/encounters/{id}/notes`, `/diagnoses` | `/encounters/[id]` | Mới, version/sign/audit |
| Service orders | clinical-orders | `/api/v1/orders` | encounter order panel | Mới; có thể thay ad-hoc step sau mapping |
| Laboratory | laboratory | `/api/v1/lab-orders`, `/lab-results` | `/laboratory` | Mới |
| Imaging | imaging | `/api/v1/imaging-orders`, `/reports` | `/imaging` | Mới, PACS/RIS adapter nếu có |
| Prescription/pharmacy | prescriptions/pharmacy | `/api/v1/prescriptions`, `/dispenses` | `/prescriptions`, `/pharmacy` | Mới |
| Inventory | inventory | `/api/v1/stock-movements` | `/inventory` | Mới, immutable movement ledger |
| Inpatient/bed | inpatient | `/api/v1/admissions`, `/beds` | `/inpatient` | Mới; tách clinic room khỏi ward/bed |
| Billing/payment | billing/payments | `/api/v1/invoices`, `/payments` | `/billing` | Mới, ledger + idempotency |
| Insurance | insurance | `/api/v1/coverages`, `/claims` | `/insurance` | Mới |
| Notification | notifications | `/api/v1/notifications` | notification center | Mới; bỏ badge giả |
| Files/documents | documents | `/api/v1/documents` | document panel | Mới, scan/private storage |
| Reports/export | reports | `/api/v1/reports`, async export jobs | `/reports` | Mới, scoped/audited download |

## Mapping bảng hiện tại sang ownership đích

| Bảng hiện tại | Owner đích |
|---|---|
| `users`, `user_profiles`, `refresh_tokens` | identity/users/auth |
| `patient_otps`, `patient_sessions` | patient-identity |
| `patients`, `patient_types` | patients/master-data |
| `room_types`, `rooms`, `room_runtimes` | facilities |
| `devices` | device-management |
| `doctor_assignments` | staffing |
| `flows`, `flow_steps`, `flow_dependencies` | workflow/service-catalog |
| `visits`, `visit_steps`, `visit_step_dependencies` | encounter/workflow-runtime |
| `routing_queues`, `visit_assignments`, `visit_tokens` | routing |
| `room_queue_entries`, `check_in_logs` | queue/check-in |
| `activity_logs` | audit |

Ownership là logical boundary trong cùng MySQL ở giai đoạn đầu; không tách database/schema vật lý nếu chưa có lý do vận hành.
