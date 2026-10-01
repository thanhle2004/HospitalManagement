-- Prevent concurrent SimulationRuns from mutating the same physical room's
-- queue and RoomRuntime. room_id is the lease key, so acquisition is atomic
-- across API processes; both foreign keys make abandoned rows recoverable.
CREATE TABLE `simulation_room_leases` (
    `room_id` INTEGER NOT NULL,
    `run_id` CHAR(36) NOT NULL,
    `acquired_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `simulation_room_leases_run_id_idx`(`run_id`),
    PRIMARY KEY (`room_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `simulation_room_leases`
    ADD CONSTRAINT `simulation_room_leases_room_id_fkey`
    FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `simulation_room_leases`
    ADD CONSTRAINT `simulation_room_leases_run_id_fkey`
    FOREIGN KEY (`run_id`) REFERENCES `simulation_runs`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
