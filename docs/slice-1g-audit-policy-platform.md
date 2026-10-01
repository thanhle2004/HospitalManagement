# Slice 1G — Audit Policy Platform

Ngày triển khai local: **2026-10-01**  
Baseline: Slice 1F closed bởi `2d8894c` và `dcffec1`

## Inventory trước implementation

- Prisma `ActivityLog`: append row với actor Staff FK nullable, action, entity/entityId, IP, user-agent, JSON metadata và timestamp; index resource và actor, chưa có retention/tamper evidence.
- Một `ActivityLogService`/`ActivityLogsRepository` duy nhất; không tạo writer hay persistence architecture thứ hai.
- Request context đã có validated request ID và normalized client address.
- Audit hiện hữu: RBAC, Staff lifecycle, profile/password/session, patient type và manual queue reorder.
- Authentication trước 1G chưa ghi success/failure. Patient/Device authentication chưa được mở rộng vì actor model/retention cho hai principal này cần proposal riêng.
- Sensitive read thực tế: patient admin list/detail và Staff directory trả PII. Clinical/pharmacy/billing chưa tồn tại nên không có placeholder action.
- Admin audit-history UI đã có pagination/detail; action/date filter backend còn thiếu.

## Rollback boundary

Slice refactor đúng ActivityLog path hiện hữu: typed catalog, metadata policy, sensitive-read application hook, query/retention contract và coverage foundation. Không migration database, không thay effective access/workspace, không sửa routing semantics. Có thể revert một commit mà không rollback dữ liệu.

## Policy đã chốt

- Action dùng uppercase snake-case, catalog machine-queryable gắn resource/category và flags `sensitiveRead`/`reasonRequired`.
- Metadata chỉ chấp nhận scalar hoặc bounded scalar array; object/request payload bị từ chối. Denylist chặn key password/passphrase/secret/token/OTP/credential/clinical note/payment.
- Action phải đúng resource; action thay đổi quyền/lifecycle yêu cầu reason.
- Sensitive-read hook ghi actor, effective roles, request/IP/user-agent, resource và tên filter; không ghi giá trị filter hoặc response payload.
- Mutation audit trong Users/RBAC/Patients/Auth là fail-closed và cùng transaction với write. Authentication failure là best-effort để lỗi audit storage không làm thay đổi response chống enumeration.
- Retention mặc định/tối thiểu 2555 ngày, không tự động delete. Archive-before-delete và explicit approval là contract; infrastructure job là debt cho production topology/legal owner.

## Coverage matrix

| Surface | Action | Actor/context | Failure policy |
|---|---|---|---|
| Staff password/profile/status/create | `STAFF_*` | Staff, request/client, reason/changed fields khi phù hợp | Same transaction, fail-closed |
| Login password thành công | `AUTHENTICATION_SUCCEEDED` | Staff + request/client, method only | Token/session/last-login/audit transaction |
| Login password thất bại | `AUTHENTICATION_FAILED` | Staff nếu biết; identity SHA-256 nếu chưa biết; request/client | Best-effort, giữ anti-enumeration |
| Logout/revoke session | `STAFF_*SESSION*` | Staff + request/client, count khi phù hợp | Same transaction, fail-closed |
| RBAC create/update/assign/revoke | `RBAC_*` | Staff + request/client + reason | Same transaction, fail-closed |
| Patient type | `PATIENT_TYPE_UPDATED` | Staff + request/client, before/after IDs | Same transaction, fail-closed |
| Patient admin list/detail | `PATIENT_RECORDS_READ` / `PATIENT_RECORD_READ` | Staff + effective roles + request/client | Fail-closed before response delivery |
| Staff directory | `STAFF_DIRECTORY_READ` | Staff + effective roles + request/client | Fail-closed before response delivery |
| Manual queue reorder | `ROOM_QUEUE_*` | Legacy actor/resource metadata | Existing behavior retained; atomicity debt requires routing approval |
| Audit history query | permission `audit.read` | Backend permission guard | Deny by default |

## Query/UI contract

`GET /activity-logs` giữ compatibility và bổ sung exact filters `action`, `entity`, `entityId`, `userId`, `from`, `to`; page/limit vẫn bounded, date range validated, order deterministic theo `createdAt DESC, id DESC`. UI bổ sung action filter và labels cho catalog foundation.

## Verification

- Focused audit/foundation regression: 6 suites, 46 tests pass.
- Full backend: 44 suites, 340 tests pass; action catalog, schema/denylist, actor roles, sensitive read, query authorization/filter/pagination, retention và failure policies đều có automated coverage.
- Frontend: 5/5 unit tests pass.
- Backend/frontend lint, type-check và production build pass.
- Prisma validate/generate, 11 migrations, drift check pass.
- DB reconciliation: 25 checks, 0 error, 0 warning; SHA-256 `e47874f7974b1591c23dda2664ada17df371ae82ba3415f2727003545a1e0096`.
- Routing/simulation suites pass. System smoke xác nhận health, Admin login, DAG, Visit, hai routing/check-in/start/complete bước; phần cuối vẫn dừng ở Doctor fixture password mismatch đã biết, database không được tự ý reseed.

## Debt và điều kiện bắt đầu 1H

- Chưa có immutable/tamper-evident audit, archive/delete worker, legal hold, SIEM/export hoặc multi-replica delivery guarantee; không phải scope hiện tại.
- Patient/Device auth event cần actor-type schema/proposal trước khi mở rộng; không nhét ID khác loại vào `userId` FK.
- Queue audit atomicity không được sửa vì frozen routing core.
- Future clinical/pharmacy/billing action chỉ được thêm cùng domain thật.
- 1H có thể bắt đầu sau owner approval: giữ catalog/query contract, thêm contract drift + Staff endpoint/browser matrix, không mở audit infrastructure hoặc business domain.

Slice dừng trước 1H.
