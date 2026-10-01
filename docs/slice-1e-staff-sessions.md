# Slice 1E — Quản lý phiên đăng nhập Staff

Ngày triển khai local: **2026-10-01**

## Phạm vi

- Gắn định danh phiên (`sid`) vào access token và refresh token mới.
- Lưu ngữ cảnh tối thiểu của phiên: user-agent, địa chỉ IP, thời điểm sử dụng gần nhất.
- Cung cấp API liệt kê phiên đang hoạt động, thu hồi một phiên thuộc chính tài khoản và thu hồi mọi phiên khác.
- Thêm màn hình hồ sơ/phiên dùng chung cho Admin và Doctor, gồm trạng thái tải/rỗng/lỗi, xác nhận trước thao tác hàng loạt và thông báo kết quả.

## API

| Method | Endpoint | Ý nghĩa |
|---|---|---|
| `GET` | `/api/v1/auth/sessions/active` | Danh sách phiên chưa bị thu hồi và chưa hết hạn |
| `DELETE` | `/api/v1/auth/sessions/others` | Thu hồi mọi phiên trừ `sid` hiện tại |
| `DELETE` | `/api/v1/auth/sessions/:id` | Thu hồi phiên theo ID, luôn giới hạn theo user hiện tại |

Phiên được tạo trước migration không có `sid` vẫn đăng nhập được cho đến khi token hết hạn, nhưng không thể dùng thao tác “đăng xuất thiết bị khác”. Đăng nhập hoặc refresh lại sẽ tạo phiên có `sid`.

## Dữ liệu và an toàn

- Migration chỉ thêm ba cột nullable và một index; không thay đổi hoặc xóa dữ liệu cũ.
- Token thô không được trả về trong danh sách phiên và không được lưu thêm; database tiếp tục chỉ lưu hash refresh token.
- Thu hồi theo ID dùng đồng thời `id` và `userId`, ngăn truy cập chéo tài khoản.
- Không thay đổi routing engine, chiến lược chọn phòng hay state machine khám bệnh.

## Rollback

Rollback ứng dụng: hoàn nguyên controller/service/UI. Các cột mới có thể giữ lại vì nullable và không ảnh hưởng phiên cũ. Chỉ drop cột/index sau khi xác nhận không còn phiên bản ứng dụng nào sử dụng chúng.
