-- Bác sĩ xác nhận đã có mặt tại đúng phòng trước khi xem hàng đợi và khám bệnh.
ALTER TABLE `doctor_assignments`
    ADD COLUMN `room_confirmed_at` DATETIME(3) NULL;
