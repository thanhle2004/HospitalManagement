ALTER TABLE `refresh_tokens`
  ADD COLUMN `device_info` VARCHAR(191) NULL,
  ADD COLUMN `ip_address` VARCHAR(191) NULL,
  ADD COLUMN `last_used_at` DATETIME(3) NULL;

CREATE INDEX `refresh_tokens_user_id_revoked_at_expires_at_idx`
  ON `refresh_tokens`(`user_id`, `revoked_at`, `expires_at`);
