# Slice 1C — Permission enforcement cho Staff API

Ngày triển khai local: **2026-10-01**

## Mục tiêu

Thay authorization Staff dựa trên role cứng hoặc implicit “mọi Staff” bằng permission code tập trung. Mapping ban đầu bảo toàn đúng quyền ADMIN/DOCTOR trước migration; chưa kích hoạt principal nghiệp vụ mới.

## Permission catalog

- `staff.manage`, `patients.manage`;
- `patient-types.read/manage`, `room-types.read/manage`, `rooms.read/manage`;
- `devices.manage`, `doctor-assignments.manage`;
- `flows.read/manage`, `visits.read`, `visits.steps.manage`;
- `doctor.workflow`, `queue.manage`, `routing.process`;
- `audit.read`, `simulation.manage`.

ADMIN nhận các quyền quản trị/giám sát hiện hữu nhưng không nhận `doctor.workflow` hoặc `visits.steps.manage`, giữ nguyên việc Admin không gọi API chuyên môn Doctor. DOCTOR nhận quyền đọc catalog/Visit cần thiết cùng hai quyền nghiệp vụ Doctor.

## Endpoint migration

Các controller users, patients admin, patient types, room types, rooms, devices, doctor assignments, flows, visits Staff, Doctor, queue, routing, activity log và simulation đã dùng `@Permissions`. Patient JWT, Device JWT và public auth endpoint không thay đổi.

## Routing impact

Không thay đổi routing service/repository/model/state/event/strategy. `routing/process-now` chỉ thay guard từ ADMIN enum sang `routing.process`; permission này chỉ seed cho ADMIN.

## Rollback

Migration chỉ insert permission và mapping. Code có thể rollback mà không drop dữ liệu. `users.role` và RolesGuard vẫn tồn tại cho compatibility nhưng không còn là authorization source của các Staff business controller đã migrate.
