INSERT INTO `permissions` (`code`, `name`, `description`, `updated_at`) VALUES
  ('staff.manage', 'Quản lý nhân viên', 'Quản lý tài khoản nhân viên hiện hữu', CURRENT_TIMESTAMP(3)),
  ('patients.manage', 'Quản lý bệnh nhân', 'Xem và cập nhật dữ liệu hành chính bệnh nhân', CURRENT_TIMESTAMP(3)),
  ('patient-types.read', 'Xem loại bệnh nhân', NULL, CURRENT_TIMESTAMP(3)),
  ('patient-types.manage', 'Quản lý loại bệnh nhân', NULL, CURRENT_TIMESTAMP(3)),
  ('room-types.read', 'Xem loại phòng', NULL, CURRENT_TIMESTAMP(3)),
  ('room-types.manage', 'Quản lý loại phòng', NULL, CURRENT_TIMESTAMP(3)),
  ('rooms.read', 'Xem phòng', NULL, CURRENT_TIMESTAMP(3)),
  ('rooms.manage', 'Quản lý phòng', NULL, CURRENT_TIMESTAMP(3)),
  ('devices.manage', 'Quản lý thiết bị', NULL, CURRENT_TIMESTAMP(3)),
  ('doctor-assignments.manage', 'Quản lý ca trực', NULL, CURRENT_TIMESTAMP(3)),
  ('flows.read', 'Xem workflow', NULL, CURRENT_TIMESTAMP(3)),
  ('flows.manage', 'Quản lý workflow', NULL, CURRENT_TIMESTAMP(3)),
  ('visits.read', 'Xem lượt khám', NULL, CURRENT_TIMESTAMP(3)),
  ('visits.steps.manage', 'Điều chỉnh bước lượt khám', NULL, CURRENT_TIMESTAMP(3)),
  ('doctor.workflow', 'Thực hiện quy trình bác sĩ', NULL, CURRENT_TIMESTAMP(3)),
  ('queue.manage', 'Giám sát và điều chỉnh hàng đợi', NULL, CURRENT_TIMESTAMP(3)),
  ('routing.process', 'Kích hoạt routing thủ công', NULL, CURRENT_TIMESTAMP(3)),
  ('audit.read', 'Xem audit log', NULL, CURRENT_TIMESTAMP(3)),
  ('simulation.manage', 'Quản lý mô phỏng', NULL, CURRENT_TIMESTAMP(3));

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id` FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`code` = 'ADMIN' AND p.`code` IN (
  'staff.manage','patients.manage','patient-types.read','patient-types.manage',
  'room-types.read','room-types.manage','rooms.read','rooms.manage','devices.manage',
  'doctor-assignments.manage','flows.read','flows.manage','visits.read','queue.manage',
  'routing.process','audit.read','simulation.manage'
);

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id` FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`code` = 'DOCTOR' AND p.`code` IN (
  'patient-types.read','room-types.read','rooms.read','flows.read','visits.read',
  'visits.steps.manage','doctor.workflow'
);
