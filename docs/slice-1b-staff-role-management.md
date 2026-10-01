# Slice 1B — Staff role management

Ngày triển khai local: **2026-10-01**

## Phạm vi

Mở rộng Slice 1A bằng danh sách Staff phân trang và giao diện gán/thu hồi nhiều role. Slice không thêm role nghiệp vụ NURSE/RECEPTIONIST/LAB/PHARMACIST/CASHIER vào auth enum vì các endpoint legacy chưa được chuyển hết sang permission policy; kích hoạt các principal mới lúc này có thể cấp quyền đọc “mọi Staff” ngoài ý muốn.

## API và quy tắc

- `GET /api/v1/staff?page=&limit=&search=&status=` trả projection an toàn, không có password/token.
- API grant/revoke từ Slice 1A được nối vào giao diện thật.
- Grant dùng upsert, chống duplicate assignment.
- Không thể thu hồi role cuối cùng của một Staff.
- Không thể thu hồi assignment `ADMIN` cuối cùng toàn hệ thống.
- Grant/revoke bắt buộc có lý do và được audit trong transaction.

## Giao diện

Trang `/admin/roles` hiện có hai vùng:

1. Danh mục role/permission và tạo role.
2. Danh sách Staff cùng dialog gán/thu hồi role.

Trang có loading, empty, error/retry, mutation pending state, validation lý do và feedback bằng toast. Sau mutation, role và Staff query được invalidate/refetch.

## Ảnh hưởng routing

Không có. Không thay đổi model, repository, event, state hoặc thuật toán routing.

## Bước tiếp theo

Trước khi tạo tài khoản cho các role nghiệp vụ mới, cần Slice 1C chuyển từng nhóm endpoint legacy từ implicit Staff access/`@Roles` sang permission code, kèm characterization/deny matrix test. Đây là security gate, không phải thay đổi routing.
