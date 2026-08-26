# ERD database hiện tại

Sơ đồ phản ánh `Backend/prisma/schema.prisma`, không phải introspection database production.

```mermaid
erDiagram
    users ||--o| user_profiles : has
    users ||--o{ refresh_tokens : owns
    users ||--o{ doctor_assignments : doctor
    users ||--o{ visit_assignments : performs
    users ||--o{ activity_logs : actor

    patient_types ||--o{ patients : classifies
    patients ||--o{ patient_otps : authenticates
    patients ||--o{ patient_sessions : owns
    patients ||--o{ visits : has

    room_types ||--o{ rooms : groups
    room_types ||--o{ flow_steps : requires
    room_types ||--o{ visit_steps : routes_to
    rooms ||--o{ devices : hosts
    rooms ||--o{ doctor_assignments : staffed_by
    rooms ||--o| room_runtimes : runtime
    rooms ||--o{ visit_assignments : assigned
    rooms ||--o{ room_queue_entries : queues

    flows ||--o{ flow_steps : defines
    flows ||--o{ visits : instantiates
    flow_steps ||--o{ flow_dependencies : dependent
    flow_steps ||--o{ flow_dependencies : prerequisite
    flow_steps o|--o{ visit_steps : origin

    visits ||--o{ visit_steps : contains
    visit_steps ||--o{ visit_step_dependencies : dependent
    visit_steps ||--o{ visit_step_dependencies : prerequisite
    visit_steps ||--o{ visit_assignments : attempts
    visit_steps ||--o| routing_queues : pending

    visit_assignments ||--o| visit_tokens : grants
    visit_assignments ||--o{ check_in_logs : scanned
    visit_assignments ||--o| room_queue_entries : queued_as
    visit_assignments o|--o| room_runtimes : current_in
    visit_assignments o|--o{ visit_assignments : rerouted_from
    devices o|--o{ check_in_logs : scans
```

## Quan hệ xóa đáng chú ý

- Cascade: user→profile/refresh; patient→session; room→device/runtime/queue; flow→steps→dependencies; visit→steps→dependencies/assignments→token/log/queue.
- Restrict/default restrict: patient type→patient, room type→room/steps, patient/flow→visit, room/user→assignment ở nhiều quan hệ lịch sử.
- Set null: patient OTP link khi patient bị xóa; room current assignment khi assignment bị xóa; một số FK optional dùng default action theo migration.

## Điểm cần xác nhận trên database thật

- `SHOW CREATE TABLE` của 24 bảng để xác nhận collation, FK action, generated/default và drift.
- `information_schema.STATISTICS` để phát hiện index ngoài Prisma.
- Migration table `_prisma_migrations` và checksum/status từng migration.
- View/routine/trigger/event không có trong source.
- MySQL mode, timezone, isolation level, charset/collation và encryption configuration.
