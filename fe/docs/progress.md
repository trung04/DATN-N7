# Tiến độ

## Đã triển khai

- Vite, React, TypeScript strict, Tailwind, giao diện responsive, router và phân quyền ba vai trò.
- Mock repository seed cố định, localStorage có reset, API adapter Axios và domain types.
- Màn hình Tourist, gợi ý/lịch trình demo, CRUD chuyến đi, booking/payment/refund/review demo.
- Dashboard Partner và Admin, quản lý phòng/tồn phòng, xác minh đối tác, dịch vụ/danh mục, kiểm duyệt, báo cáo, đối soát.
- Kiểm thử unit nghiệp vụ và E2E các luồng chính.

## Chưa tích hợp thật

Backend, Google OAuth, email OTP, AI/LLM, VNPAY, refund, chuyển khoản, upload ảnh và bản đồ tương tác. API contract là đề xuất.

## Kiểm tra ngày 25/10/2026

- `npm run lint`: đạt.
- `npm run typecheck`: đạt.
- `npm run test`: 10 unit test đạt, gồm OTP, booking/tồn phòng/thanh toán, hủy và chính sách chụp tại lúc đặt, refund, đánh giá, lập lịch theo giờ mở cửa và xung đột, lịch phòng và đối soát.
- `npm run test:e2e`: 16 kịch bản đạt trên desktop/mobile; gồm tìm kiếm/lọc khách sạn và giữ bộ lọc, phân quyền/404, lịch trình, Partner, booking/hủy/hoàn tiền, xác minh đối tác/đối soát và kiểm tra tràn ngang 360px.
- `npm run build`: đạt với Vite 8.3.5.

Chế độ API mới là contract đề xuất; các kiểm thử trên chạy ở mock mode và chưa xác nhận khả năng tích hợp với backend thật.

## Bổ sung seed ngày 26/10/2026

- Thêm 15 điểm đến, 5 khách sạn, 6 loại phòng, 7 nhà hàng; dữ liệu mới trải rộng Đà Nẵng, Đà Lạt, Quảng Nam, Huế và Nha Trang.
- Thêm 2 chuyến đi, 4 booking với các trạng thái hoàn tất/xác nhận/đã hủy, 2 đánh giá, 1 refund đã hoàn, 2 đối tác, 6 dịch vụ và 1 kỳ đối soát.
- Tạo lịch phòng theo ngày cho mọi loại phòng mới. Bộ lập lịch lấy danh sách thành phố từ danh mục thay cho danh sách cố định.
- Nâng seed từ v2 lên v3 trong cùng localStorage: bổ sung bản ghi thiếu, giữ bản ghi cũ đã chỉnh sửa và tránh thêm trùng.
- Kiểm tra lại: `npm run lint`, `npm run typecheck`, `npm run build` đều đạt; `npm run test` đạt 12/12; `npm run test:e2e` đạt 18/18 trên desktop và mobile.

## Cân lại giao diện Admin ngày 26/10/2026

- Mở rộng khung quản trị trên màn hình desktop, căn header và sidebar theo cùng chiều rộng; menu mobile hiển thị hai cột.
- Thay dashboard ngắn bằng các nhóm dữ liệu thực: chỉ số chính, trạng thái booking, hồ sơ/hoàn tiền cần xử lý, booking gần đây và đối soát cần duyệt.
- Kiểm tra lại: `npm run lint`, `npm run typecheck`, `npm run build` đều đạt; `npm run test` đạt 12/12; `npm run test:e2e` đạt 20/20, gồm kiểm tra layout ở 1889px và 360px.

## Giao diện du khách và lịch trình ngày 26/10/2026

- Tách bố cục du khách theo hướng khám phá: ảnh minh họa địa phương, tìm khách sạn nổi bật trên trang chủ, card có ảnh và nội dung ngắn; trang khách sạn có vùng giới thiệu riêng. Partner/Admin giữ sidebar và bố cục quản trị.
- Làm lại trang lập lịch demo với biểu mẫu dễ theo dõi, tab từng ngày, lý do chọn điểm đến từ dữ liệu danh mục, chi phí tách nhóm, tinh chỉnh nhịp độ và bản nháp giữ qua đăng nhập.
- Bộ lập lịch tránh lặp điểm dừng trong cùng ngày, kiểm tra giờ mở cửa, ưu tiên sở thích/yêu cầu bổ sung, chọn địa điểm vừa phần ngân sách hoạt động khi có thể và ghi rõ giả định chi phí.
- Kiểm tra lại: `npm run lint`, `npm run typecheck`, `npm run build` đạt; `npm run test` đạt 13/13; `npm run test:e2e` đạt 22/22 trên desktop và mobile.

## Mở rộng không gian hiển thị ngày 26/10/2026

- Trang chủ và header/footer du khách dùng khung co giãn theo màn hình; bỏ giới hạn 1.240px cho các khu vực này. Thanh tìm kiếm mở rộng cùng hero, khách sạn và trải nghiệm hiển thị bốn card mỗi hàng trên desktop.
- Admin bỏ giới hạn 1.640px, sử dụng chiều rộng khả dụng sau lề và sidebar. Ở 1.920px, trang chủ có lề 48px và Admin khoảng 32px mỗi bên.
- Kiểm tra căn hàng, độ rộng và tràn ngang ở 360px, 1.440px, 1.920px và 2.560px; đã xem ảnh chụp desktop/mobile.
- `npm run lint`, `npm run typecheck`, `npm run build` đạt; `npm run test` đạt 13/13; `npm run test:e2e` đạt 24/24.
