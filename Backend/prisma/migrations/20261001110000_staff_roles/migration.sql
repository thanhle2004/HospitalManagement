ALTER TABLE `users`
  MODIFY `role` ENUM(
    'ADMIN',
    'DOCTOR',
    'NURSE',
    'RECEPTIONIST',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'CASHIER'
  ) NOT NULL;

INSERT INTO `roles` (`code`, `name`, `description`, `is_system`, `updated_at`) VALUES
  ('NURSE', 'Điều dưỡng', 'Vai trò điều dưỡng; permission nghiệp vụ được cấp theo từng slice', true, CURRENT_TIMESTAMP(3)),
  ('RECEPTIONIST', 'Lễ tân', 'Vai trò tiếp nhận; permission nghiệp vụ được cấp theo từng slice', true, CURRENT_TIMESTAMP(3)),
  ('LAB_TECHNICIAN', 'Kỹ thuật viên xét nghiệm', 'Vai trò cận lâm sàng; permission nghiệp vụ được cấp theo từng slice', true, CURRENT_TIMESTAMP(3)),
  ('PHARMACIST', 'Dược sĩ', 'Vai trò cấp phát thuốc; permission nghiệp vụ được cấp theo từng slice', true, CURRENT_TIMESTAMP(3)),
  ('CASHIER', 'Thu ngân', 'Vai trò thanh toán; permission nghiệp vụ được cấp theo từng slice', true, CURRENT_TIMESTAMP(3));
