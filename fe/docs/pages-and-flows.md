# Trang và luồng

| Vai trò | Route | Nghiệp vụ | Trạng thái |
| --- | --- | --- | --- |
| Công khai | /, /explore, /explore/:id | Trang chủ, tìm và xem điểm đến; UC06 | Demo |
| Công khai | /hotels, /hotels/:id | Tìm, lọc, xem khách sạn/phòng; UC07 | Demo |
| Công khai | /restaurants, /restaurants/:id | Tìm, lọc, xem nhà hàng | Demo |
| Công khai | /ai/recommendations, /ai/trip-planner | Gợi ý và lịch trình theo quy tắc demo | Demo |
| Công khai | /auth/login, /auth/register, /auth/verify-otp, /auth/forgot-password, /auth/reset-password | UC01–03, OTP demo | Demo |
| Du khách | /profile, /preferences, /favorites | UC04–05, hồ sơ/sở thích/yêu thích | Demo |
| Du khách | /trips, /trips/new, /trips/:id, /trips/:id/edit | UC08–10, chuyến đi/điểm dừng/hoạt động | Demo |
| Du khách | /bookings/new, /bookings, /bookings/:id, /bookings/:id/payment, /bookings/:id/payment-result | Đặt phòng, thanh toán, hủy/hoàn tiền, đánh giá | Demo |
| Đối tác | /partner, /partner/rooms, /partner/rooms/new, /partner/rooms/:id/edit, /partner/rooms/:id/inventory | Dashboard, loại phòng và lịch bán | Demo |
| Admin | /admin, /admin/partners, /admin/partners/:id | Tổng quan và UC27 xác minh đối tác | Demo |
| Admin | /admin/services, /admin/service-categories, /admin/reviews, /admin/reviews/:id | Dịch vụ, danh mục, kiểm duyệt | Demo |
| Admin | /admin/reports, /admin/settlements, /admin/settlements/:id | Thống kê và chi trả đối tác | Demo |
| Tất cả | /403, route không tồn tại | Không có quyền, không tìm thấy | Hoạt động |

Router kiểm tra vai trò trước khi mở trang protected, lưu returnTo để quay lại sau đăng nhập và chuyển vai trò sai sang 403. Backend phải kiểm tra lại quyền trên mọi endpoint thật.

Giao diện công khai/du khách dùng thanh điều hướng ngang, ảnh minh họa và tìm kiếm nổi bật. Partner/Admin dùng sidebar, bảng, form và dashboard. Bộ lập lịch tại `/ai/trip-planner` đi theo luồng chọn nhu cầu → xem từng ngày và chi phí → tinh chỉnh → lưu; khách chưa đăng nhập giữ bản nháp trong phiên khi chuyển sang đăng nhập.
