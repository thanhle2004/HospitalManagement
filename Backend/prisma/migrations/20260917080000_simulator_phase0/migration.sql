-- Admin Patient Flow Simulator — Phase 0
-- Additive only: 2 nullable columns on existing tables, 1 nullable override
-- column on `rooms`, and 4 new tables. Nothing here changes the behaviour of
-- any existing query — no column is read by production code yet.

-- AlterTable
ALTER TABLE `patients`
    ADD COLUMN `simulation_run_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `visits`
    ADD COLUMN `simulation_run_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `rooms`
    ADD COLUMN `avg_process_time` INTEGER NULL;

-- CreateTable
CREATE TABLE `simulation_runs` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PREPARING', 'RUNNING', 'PAUSED', 'DRAINING', 'COMPLETED', 'STOPPING', 'STOPPED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `mode` ENUM('LOCKSTEP', 'CONCURRENT') NOT NULL,
    `seed` INTEGER NOT NULL,
    `config` JSON NOT NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `sim_end_time_ms` INTEGER NULL,
    `summary` JSON NULL,
    `fixture_ids` JSON NULL,
    `created_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `simulation_runs_status_idx`(`status`),
    INDEX `simulation_runs_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `simulation_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `run_id` CHAR(36) NOT NULL,
    `sim_time_ms` INTEGER NOT NULL,
    `seq` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `visit_id` CHAR(36) NULL,
    `visit_step_id` INTEGER NULL,
    `room_id` INTEGER NULL,
    `payload` JSON NULL,

    INDEX `simulation_events_run_id_sim_time_ms_idx`(`run_id`, `sim_time_ms`),
    INDEX `simulation_events_run_id_visit_id_idx`(`run_id`, `visit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `simulation_violations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `run_id` CHAR(36) NOT NULL,
    `sim_time_ms` INTEGER NOT NULL,
    `rule` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `visit_id` CHAR(36) NULL,
    `visit_step_id` INTEGER NULL,
    `room_id` INTEGER NULL,
    `state_snapshot` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `simulation_violations_run_id_rule_idx`(`run_id`, `rule`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routing_decisions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `visit_step_id` INTEGER NOT NULL,
    `run_id` CHAR(36) NULL,
    `strategy` VARCHAR(191) NOT NULL,
    `selected_room_id` INTEGER NULL,
    `reason` VARCHAR(191) NOT NULL,
    `candidates` JSON NOT NULL,
    `decided_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sim_time_ms` INTEGER NULL,

    INDEX `routing_decisions_visit_step_id_idx`(`visit_step_id`),
    INDEX `routing_decisions_run_id_selected_room_id_idx`(`run_id`, `selected_room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `patients_simulation_run_id_idx` ON `patients`(`simulation_run_id`);

-- CreateIndex
CREATE INDEX `visits_simulation_run_id_idx` ON `visits`(`simulation_run_id`);

-- AddForeignKey
ALTER TABLE `patients` ADD CONSTRAINT `patients_simulation_run_id_fkey` FOREIGN KEY (`simulation_run_id`) REFERENCES `simulation_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `visits` ADD CONSTRAINT `visits_simulation_run_id_fkey` FOREIGN KEY (`simulation_run_id`) REFERENCES `simulation_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `simulation_events` ADD CONSTRAINT `simulation_events_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `simulation_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `simulation_violations` ADD CONSTRAINT `simulation_violations_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `simulation_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routing_decisions` ADD CONSTRAINT `routing_decisions_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `simulation_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;