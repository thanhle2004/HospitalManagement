# Câu hỏi cần xác nhận trước Giai đoạn 2

Mỗi câu hỏi cần `owner`, `deadline`, `decision`, `effective date` và tài liệu nguồn. Không có câu trả lời thì dùng phương án mặc định được ghi, nhưng phải được duyệt trước implementation.

## 1. Phạm vi và nguồn sự thật

1. Workspace này là hệ thống legacy đang chạy, prototype mới, hay chỉ một phần của hệ thống lớn hơn?
2. Database production/staging nằm ở đâu, MySQL version nào, dung lượng/record count/RPO/RTO ra sao?
3. Có ứng dụng mobile Patient, Android scanner, ETL/report hoặc service khác truy cập trực tiếp DB không?
4. Có schema, view, trigger, procedure, event, cron ngoài repo không?
5. Source nào là writer chính cho từng bảng? Có đồng bộ với HIS/LIS/RIS/PACS/pharmacy/payment hiện hữu không?
6. Thị trường/pháp vực triển khai và yêu cầu retention, consent, breach notification, data residency là gì?

Mặc định đề xuất: coi database hiện hữu là source-of-truth duy nhất cho các bảng trong schema cho đến khi inventory chứng minh khác.

## 2. Tổ chức, role và quyền

7. Một bệnh viện hay nhiều facility/tenant? User có thể thuộc nhiều facility/department không?
8. Ngoài Admin/Doctor cần role nào: receptionist, nurse, technician, pharmacist, cashier, insurer, auditor, patient caregiver?
9. Doctor được xem bệnh nhân theo care team, ca trực, khoa, facility hay toàn viện?
10. Ai được xem/sửa identity number, phone, address, clinical note, result, payment và audit log?
11. Có yêu cầu break-glass khẩn cấp không? Ai phê duyệt và audit thế nào?
12. Khóa user/device phải có hiệu lực tức thời hay chấp nhận tối đa access-token TTL?
13. Có yêu cầu dual approval cho role cao, refund, controlled medication hay amendment clinical record không?

Mặc định đề xuất: deny by default; scope theo facility + care relationship; break-glass cần reason và alert.

## 3. Patient identity

14. Phone là định danh đăng nhập hay định danh bệnh nhân duy nhất? Trẻ em/người không có phone dùng cách nào?
15. Quy tắc chuẩn hóa `0`/`+84`, email, identity number và foreign patient?
16. Khi duplicate patient, ai được merge/unmerge? Lịch sử và audit cần giữ thế nào?
17. `PatientType` nghĩa là phân loại vận hành, ưu tiên, gói dịch vụ hay bảo hiểm?
18. `STANDARD` có bắt buộc duy nhất/không được xóa không?
19. Consent nào cần ghi nhận cho SMS, portal, chia sẻ hồ sơ và research/report?

## 4. Appointment, Visit, Encounter và workflow

20. Định nghĩa chính thức của Appointment, Visit, Encounter/Episode và quan hệ giữa chúng?
21. Patient có được tự tạo Visit trực tiếp hay phải qua appointment/reception/triage?
22. Một patient được có bao nhiêu Visit active đồng thời?
23. `Flow` là gói dịch vụ, clinical pathway hay routing template? Ai publish/version?
24. Flow đã được dùng có cho sửa step/dependency không, hay phải tạo version mới?
25. Step `SKIPPED/CANCELLED` có được coi dependency “resolved” trong mọi trường hợp không?
26. Khi Doctor thêm ad-hoc step, đó có phải clinical order và có cần lý do/chữ ký/giá không?
27. Khi nào Visit chuyển IN_PROGRESS: lúc check-in đầu tiên, start exam đầu tiên hay encounter mở?
28. Điều kiện COMPLETE/CANCEL và reopen/amend là gì?

Mặc định đề xuất: workflow definition immutable sau publish; Visit/Encounter state machine riêng được business ký.

## 5. Routing, queue và staffing

29. ETA chính thức dùng waiting count, current exam, doctor count, capability, priority hay triage severity?
30. FIFO tuyệt đối hay có cấp cứu/VIP/appointment-time priority? Ai được override và cần reason gì?
31. Room ACTIVE có bắt buộc Doctor đang trực mới được routing tới không? Source hiện tại không kiểm tra điều này.
32. Một Doctor được trực đồng thời nhiều room không? Một room có nhiều Doctor không?
33. No-show timeout bao lâu? QR hết hạn thì reroute/cấp lại/cancel ra sao?
34. Room maintenance khi đang có queue/current exam xử lý drain/reroute thế nào?
35. Queue reorder có cần thông báo bệnh nhân/Doctor và giữ before/after snapshot không?
36. Scanner offline cần hoạt động thế nào; manual check-in fallback ai được phép?

## 6. Clinical modules

37. Chuẩn mã chẩn đoán/procedure/lab/medication nào phải dùng (ICD, LOINC, local catalog, v.v.)?
38. Clinical note/result/prescription cần draft, sign, co-sign, amend và legal signature thế nào?
39. Dị ứng, tương tác thuốc, critical result và escalation rule là bắt buộc ở mức nào?
40. LIS/RIS/PACS/pharmacy nào sẽ tích hợp; protocol/API/source-of-truth/retry/reconciliation?
41. File nào được upload, format/size/retention và malware scanning requirement?
42. Có dữ liệu bệnh án legacy cần import không; mapping và quality owner là ai?

## 7. Billing, insurance và reporting

43. Currency/tax/rounding/price effective date và payer hierarchy?
44. Charge phát sinh ở order, execution, result hay completion?
45. Cho partial payment, deposit, refund, void, write-off và cash shift không?
46. Payment gateway/terminal nào; idempotency/reconciliation/settlement cadence?
47. Insurance coverage/authorization/claim lifecycle và external code set?
48. Dashboard/report nào là bắt buộc, timezone/cutoff và định nghĩa metric được ai ký?
49. Ai được export dữ liệu; format, row limit, watermark, expiry và approval?

## 8. Operations và migration

50. Deployment target: on-prem/cloud/hybrid; số replica, network zone, secret manager?
51. Downtime cho phép ở cutover; peak traffic và growth projection?
52. Backup hiện tại, RPO/RTO, encryption key owner và restore gần nhất?
53. Có staging data ẩn danh hợp pháp không? Ai xác nhận de-identification?
54. Có thể chạy old/new song song theo facility/module không? Source-of-truth từng giai đoạn?
55. Acceptance owner cho từng vertical slice và manual UAT script là ai?
56. Rollback window và tiêu chí abort/cutover là gì?
57. Legacy giữ read-only bao lâu và archive/decommission theo chính sách nào?

## 9. Quyết định tối thiểu để duyệt Slice 0

- Trả lời câu 1–6, 20, 23, 29–34, 50–57.
- Cung cấp schema dump + anonymized clone + sample query/load profile.
- Chỉ định business owner, security/privacy owner và DBA owner.
- Xác nhận không chạy migration production hoặc thay infrastructure trong Slice 0 nếu chưa có approval riêng.
