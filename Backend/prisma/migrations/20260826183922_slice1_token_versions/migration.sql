-- AlterTable
ALTER TABLE `devices` ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `patients` ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 0;
