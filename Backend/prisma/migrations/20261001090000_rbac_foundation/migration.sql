CREATE TABLE `roles` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `is_system` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `roles_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `permissions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `permissions_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `role_permissions` (
  `role_id` INTEGER NOT NULL,
  `permission_id` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `role_permissions_permission_id_idx`(`permission_id`),
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_role_assignments` (
  `user_id` CHAR(36) NOT NULL,
  `role_id` INTEGER NOT NULL,
  `assigned_by_id` CHAR(36) NULL,
  `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `user_role_assignments_role_id_idx`(`role_id`),
  INDEX `user_role_assignments_assigned_by_id_idx`(`assigned_by_id`),
  PRIMARY KEY (`user_id`, `role_id`),
  CONSTRAINT `user_role_assignments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_role_assignments_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `user_role_assignments_assigned_by_id_fkey` FOREIGN KEY (`assigned_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `roles` (`code`, `name`, `description`, `is_system`, `updated_at`) VALUES
  ('ADMIN', 'Quản trị viên', 'Vai trò tương thích với UserRole.ADMIN', true, CURRENT_TIMESTAMP(3)),
  ('DOCTOR', 'Bác sĩ', 'Vai trò tương thích với UserRole.DOCTOR', true, CURRENT_TIMESTAMP(3));

INSERT INTO `permissions` (`code`, `name`, `description`, `updated_at`) VALUES
  ('rbac.manage', 'Quản lý vai trò và quyền', 'Xem và thay đổi role/permission của nhân viên', CURRENT_TIMESTAMP(3));

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id` FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`code` = 'ADMIN' AND p.`code` = 'rbac.manage';

INSERT INTO `user_role_assignments` (`user_id`, `role_id`, `assigned_by_id`)
SELECT u.`id`, r.`id`, NULL
FROM `users` u
JOIN `roles` r
  ON r.`code` = CONVERT(CAST(u.`role` AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci;
