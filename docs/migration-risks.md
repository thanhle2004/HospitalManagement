# Risk register và technical debt

Mức độ: **P0** chặn production/migration; **P1** phải xử lý trước slice liên quan; **P2** cải thiện có kế hoạch; **P3** theo dõi.

## 1. Risk register

| ID | Ưu tiên | Rủi ro/bằng chứng | Tác động | Kiểm soát/điều kiện đóng |
|---|---|---|---|---|
| R-01 | P0 | Chưa có schema/dump/profile database thật | Không chứng minh bảo toàn dữ liệu | Clone ẩn danh, inventory `information_schema`, checksum/count, owner ký xác nhận |
| R-02 | P0 | Migration thứ hai drop table/cột và đổi PK có cảnh báo dữ liệu | Mất dữ liệu nếu replay | Baseline database đích; không replay history cũ; rehearsal restore |
| R-03 | P0 | OTP + phone log plaintext; seed log password | Lộ PHI/credential qua log | Tắt mock ở non-dev, redact, log policy test, rotate secret nếu đã dùng |
| R-04 | P0 | Access/refresh token staff ở `localStorage` | XSS đánh cắp phiên | BFF/httpOnly Secure SameSite cookie hoặc token-in-memory + hardened refresh cookie |
| R-05 | P0 | Không integration/API/E2E/authorization/migration test | Không có safety net để refactor | Characterization test cho 12 luồng tối thiểu + state invariant + DB clone |
| R-06 | P0 | Không có backup/restore proof | Rollback dữ liệu không đáng tin | Backup có checksum, restore rehearsal, RPO/RTO và runbook được ký |
| R-07 | P1 | Lock user/device không revoke access token; JWT strategy không check state | Tài khoản bị khóa vẫn thao tác | Token version/session status, short TTL, revoke refresh; test khóa tức thời |
| R-08 | P1 | Role-only, thiếu resource scope; mọi Doctor có thể xem/sửa Visit rộng | IDOR/BOLA, lộ dữ liệu bệnh nhân | Policy theo assignment/facility/care-team, deny-by-default authorization tests |
| R-09 | P1 | Endpoint “doctors/:id” không assert target role | Admin có thể lock/unlock Admin khác | Target-type guard, self-protection/two-person rule nếu cần, audit |
| R-10 | P1 | CORS HTTP mở; WebSocket `origin:true` | Client độc hại gọi API/socket | Allowlist theo môi trường, credential policy, origin tests |
| R-11 | P1 | Không rate limit login/OTP/device login/QR | Brute force, SMS abuse, DoS | Per-IP/identity/device limits, cooldown, CAPTCHA/risk controls, alert |
| R-12 | P1 | OTP consume không atomic | Replay/concurrent login session | Conditional update trong transaction; idempotency/reuse test |
| R-13 | P1 | Shift overlap check-then-insert | Ca trực trùng khi concurrent | Lock/advisory lock/serializable unit; concurrency test |
| R-14 | P1 | Queue max+1 và fractional reorder không lock/rebalance | Unique collision/thứ tự sai | Transaction lock, deterministic sequence/rank, rebalance + audit |
| R-15 | P1 | Step/assignment dual state không DB-enforced | Workflow drift, bệnh nhân kẹt | Transition service, conditional writes, reconciliation job/test |
| R-16 | P1 | Visit enum có IN_PROGRESS/CANCELLED nhưng không transition | Dashboard/report sai | State chart được nghiệp vụ duyệt; implement/test hoặc loại enum bằng migration an toàn |
| R-17 | P1 | Cancel/no-show/reroute modeled nhưng không implemented | Queue và history không xử lý ngoại lệ | Use case + reason + actor + audit + compensation/rollback |
| R-18 | P1 | Audit chỉ ghi hai action reorder | Không truy vết thao tác y tế/quyền | Audit matrix, interceptor/domain event, DB least privilege, retention |
| R-19 | P1 | QR token lưu/response plaintext, Staff detail rộng | Token bị lộ có thể bị dùng lại qua device bị chiếm | Hash QR, minimize response, audience/scope/expiry, scan replay test |
| R-20 | P1 | Auto migration chạy cùng app startup | Multi-replica race/không có approval | Migration job riêng, manual gate, preflight/postcheck, backward-compatible deploy |
| R-21 | P1 | Không structured logging/correlation ID/redaction | Điều tra incident khó, log PII | JSON logger, request ID, field denylist, trace propagation |
| R-22 | P1 | Không security headers; Swagger có thể public ở production | XSS/info disclosure | Helmet/CSP, docs auth/disable theo env, scan headers |
| R-23 | P1 | `.env`/`.env.local` tồn tại, không `.gitignore`, workspace không Git | Secret dễ bị copy/commit | Secret scan, `.gitignore`, rotate nếu từng chia sẻ, vault/secret manager |
| R-24 | P1 | Phone không canonicalize 0/+84 | Duplicate patient/nhầm hồ sơ | E.164 canonicalization, dedupe/merge workflow trước unique migration |
| R-25 | P1 | `STANDARD` soft-deleted vẫn được lookup mặc định | Gán category đã xóa | Query `deletedAt:null`, immutable default setting, invariant test |
| R-26 | P1 | Hard-delete FlowStep/shift làm mất lịch sử hoặc bị FK chặn | Audit/history thiếu, API lỗi | Effective dating/soft delete; không xóa record đã dùng; correction workflow |
| R-27 | P1 | Room chuyển maintenance khi có queue/current visit | Bệnh nhân mắc kẹt | Precondition + drain/reroute workflow + confirmation/audit |
| R-28 | P1 | Cron/event/socket chỉ local process | Scale ngang mất/nhân đôi event | DB worker claim + outbox; distributed scheduler; Socket.IO shared adapter |
| R-29 | P2 | `GET /visits` và list khác không pagination | Memory/latency, dashboard tải toàn bộ | Pagination/filter/sort contract; aggregate endpoint |
| R-30 | P2 | Routing dùng N count queries và snapshot stale | Tải DB, phân phòng lệch | Grouped query/atomic scoring; performance test và chấp nhận độ lệch rõ |
| R-31 | P2 | Repository export chéo module | Refactor lan rộng | Application ports, ownership bảng, architecture lint/test |
| R-32 | P2 | Backend/frontend duplicate type | Contract drift | OpenAPI-generated client hoặc package contracts có version |
| R-33 | P2 | UI thiếu error/empty/pagination/mobile navigation | Vận hành sai/khó dùng tablet | UX acceptance checklist + accessibility test |
| R-34 | P2 | Header search/notification/profile là placeholder | Người dùng hiểu nhầm chức năng | Ẩn đến khi có hoặc triển khai end-to-end |
| R-35 | P2 | Docker image chứa dev dependencies, DB port mở | Attack surface | Production image tối thiểu, non-root, private DB network, image scan |
| R-36 | P2 | Không lifecycle cleanup token/OTP/log | Bloat và retention vi phạm | Retention policy + purge/archive job có audit |

## 2. Technical debt theo lớp

### Domain

- State transition rải giữa Visits/Routing/CheckIn/Doctor.
- Thiếu aggregate/policy cho quyền Doctor với Visit/Patient.
- Không có khái niệm facility/department/tenant, encounter/clinical order hay financial ledger.
- Dùng hard delete cho shift và FlowStep dù có giá trị lịch sử.

### Application/API

- Chưa API versioning, idempotency, pagination chuẩn, request ID.
- Response envelope áp cho mọi response nhưng chưa xử lý đặc thù stream/download/204 rõ.
- Swagger chỉ dựa decorator/DTO, chưa có contract test so runtime.
- Exception filter có thể log stack; chưa redaction và error code ổn định.

### Persistence

- Prisma transaction có nhưng một số check/write tách rời.
- Index token hash thiếu; dashboard/query list không theo workload.
- Không baseline/rollback/data reconciliation.
- Không schema governance cho JSON metadata.

### Frontend

- Auth hoàn toàn client-side và token persistent.
- Gần như toàn bộ page là Client Component; chưa tận dụng Server Component/BFF.
- Không WebSocket integration dù backend có.
- Không test, error boundary, mobile menu, pagination/filter/search.

### Operations

- Không CI, IaC, staging, monitoring, metrics, alerts, backup/runbook.
- Migration gắn với startup.
- Credential demo và mock behavior dễ lọt production.

## 3. Gate bắt buộc trước Giai đoạn 2

1. Cung cấp dump schema + anonymized clone và xác nhận nguồn dữ liệu chính.
2. Hoàn tất backup/restore rehearsal.
3. Baseline migration strategy được DBA/owner duyệt.
4. Security hotfix plan cho OTP logs, token storage, CORS, rate limit, token revoke.
5. Characterization test cho patient-flow hiện tại đạt trên clone.
6. Quyết định business cho state machine/cancel/reroute/no-show.
7. Data ownership và permission matrix theo role/scope được ký.

## 4. Cập nhật mitigation Slice 0 — 2026-08-27

- R-03: đã bỏ log OTP/phone và password seed; mock SMS không còn lộ mã.
- R-06: backup có SHA-256 và restore rehearsal local pass; RPO/RTO production vẫn chưa có owner.
- R-10, R-20, R-21, R-22, R-23: đã có CORS allowlist HTTP/Socket.IO, migration job riêng, structured request log/request ID, Helmet/Swagger policy, Git baseline/.gitignore/Gitleaks.
- R-05: tăng từ 19 lên 31 test với characterization cho auth/visit/check-in/doctor, cộng DB/runtime smoke; E2E/authorization đầy đủ vẫn mở.
- Dependency advisory mới được ghi nhận: backend production tree 18 advisory (4 high), frontend 1 high. Nâng major NestJS/Swagger chưa được thực hiện vì ngoài phê duyệt Slice 0.
