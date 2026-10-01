-- Standardise persisted average processing durations from minutes to seconds.
-- Both updates are kept in one transaction so a failure cannot leave RoomType
-- values converted while Room overrides are still in the former unit.
START TRANSACTION;

UPDATE `room_types`
SET `avg_process_time` = `avg_process_time` * 60
WHERE `avg_process_time` IS NOT NULL;

UPDATE `rooms`
SET `avg_process_time` = `avg_process_time` * 60
WHERE `avg_process_time` IS NOT NULL;

COMMIT;
