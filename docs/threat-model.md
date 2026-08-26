# Threat model dữ liệu y tế

## 1. Tài sản và trust boundary

Tài sản chính: hồ sơ định danh bệnh nhân, lịch sử lượt khám/luồng phòng, credential/token/OTP/QR, lịch bác sĩ, audit log và dữ liệu tài chính/clinical sẽ bổ sung.

Trust boundary:

1. Browser/mobile/device ↔ Internet/reverse proxy.
2. Next.js/BFF ↔ NestJS API.
3. API/worker ↔ MySQL/object storage/external provider.
4. Admin/Doctor/Patient/Device giữa các scope khác nhau.
5. Log/monitoring/backup ↔ production data.

## 2. Threat matrix theo luồng yêu cầu

| Luồng | Threat chính | Hiện trạng | Kiểm soát bắt buộc/verification |
|---|---|---|---|
| Đăng nhập | Brute force, credential stuffing, OTP enumeration/replay, token theft, session fixation | Không rate limit; OTP log plaintext; JWT split secret; refresh rotation | Rate limit theo IP+identity, response chống enumeration, atomic OTP consume, MFA/risk control cho privileged user, httpOnly cookie, token version/revoke, auth audit, penetration test |
| Xem/sửa hồ sơ bệnh nhân | IDOR/BOLA, role escalation, excessive data, caching/log leakage | Patient own check có; Staff/Doctor scope rộng; không patient update API | Policy theo facility/care-team/purpose, field-level projection/masking, no-store cache, audit read/write, authorization matrix test với mọi role/resource |
| Kê đơn | Doctor giả mạo, kê sai bệnh nhân, duplicate submit, interaction/allergy missed, sửa sau ký | Chưa có module | Signed prescription lifecycle draft→signed→dispensed/cancelled, prescriber scope, immutable version, allergy/interaction policy, idempotency, second factor cho controlled drug theo luật, audit |
| Trả kết quả xét nghiệm | Result tampering, nhầm specimen/patient, công bố sớm, webhook spoof | Chưa có module | Accession/specimen chain of custody, performer/verifier separation, signed/versioned result, abnormal critical alert, release policy, integration signature/replay protection, audit |
| Thanh toán | Duplicate charge, amount tampering, callback spoof, refund abuse, sensitive card data | Chưa có module | Server-side price, immutable ledger, idempotency key, gateway signature/timestamp, reconciliation, RBAC/dual approval refund, không lưu card data, audit |
| Xuất báo cáo | Mass exfiltration, filter bypass, formula injection, insecure link | Chưa có module | Export permission + purpose, row/field scope, async job, one-time signed download, encryption, watermark/audit, rate/size limit, CSV formula neutralization, retention |
| Upload/download tài liệu | Malware, polyglot/path traversal, IDOR, public bucket, metadata leak | Không có file module | Allowlist MIME+magic bytes, size/name normalization, malware scan/quarantine, private object storage, scoped signed URL, content disposition, encryption, retention, access audit |
| Quản trị user/quyền | Privilege escalation, lockout Admin, stale token, silent permission change | Chỉ ADMIN/DOCTOR role; target role bug; audit thiếu | Permission model, prohibit unsafe self-escalation, dual approval cho quyền cao, token invalidation, reason required, complete before/after audit, periodic access review |

## 3. STRIDE tóm tắt cho patient-flow hiện tại

| Loại | Ví dụ hiện tại | Ưu tiên |
|---|---|---|
| Spoofing | Device token còn sống sau disable; OTP bị lộ log | P0/P1 |
| Tampering | Queue/state cập nhật concurrent; audit không immutable | P1 |
| Repudiation | Hầu hết mutation không có activity log/correlation ID | P1 |
| Information disclosure | localStorage token, permissive CORS, patient phone trong queue, QR plaintext | P0/P1 |
| Denial of service | OTP/login/routing process-now không rate limit; list unbounded | P1/P2 |
| Elevation of privilege | Doctor sửa mọi Visit; “doctor/:id” không assert role | P1 |

## 4. Logging và privacy rules

- Denylist: password, access/refresh/device token, OTP, QR token, identity number, clinical note/result, payment secret.
- Patient identifiers trong log phải pseudonymize hoặc chỉ record ID khi cần.
- Log phải có `requestId`, actor type/id, action, resource type/id, outcome, timestamp, source IP chuẩn hóa; metadata theo schema và redaction.
- Audit database role của app không có UPDATE/DELETE đối với historical log nếu thiết kế cho phép.
- Retention, legal hold, patient access/correction/deletion phải do thị trường triển khai quyết định; không tuyên bố HIPAA/compliance khi chưa đánh giá chính thức.

## 5. Security acceptance gates

- Automated authorization tests cho mỗi role × action × own/other/facility resource.
- SAST/dependency/secret/image scan; DAST staging.
- Brute-force/OTP replay/token revoke/CSRF/XSS/IDOR test.
- Upload malware/path test khi có file.
- Payment/lab webhook signature and replay test khi tích hợp.
- Restore test đảm bảo encryption key và audit trail còn dùng được.
