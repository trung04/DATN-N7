# Hành Trình Việt — Smart Travel Frontend

Ứng dụng React + TypeScript cho đồ án hệ thống du lịch thông minh. Giao diện tiếng Việt gồm khu vực khách du lịch, đối tác khách sạn và quản trị viên. Chế độ mặc định dùng dữ liệu demo có thể thao tác và đặt lại; dự án không chứa backend, AI server hoặc cổng thanh toán thật.

## Công nghệ và cài đặt

React, TypeScript strict, Vite, React Router, Tailwind CSS, thành phần UI theo cấu hình shadcn/ui và Radix, Lucide, TanStack Query, Zustand, React Hook Form, Zod, Axios, Recharts, date-fns, Vitest, React Testing Library và Playwright. Phiên bản cụ thể nằm trong package-lock.json. Yêu cầu Node.js 22.12+ và npm hiện đại trên Linux, macOS hoặc Windows.

    npm ci
    npm run dev

Sao chép .env.example thành .env.local trước khi chạy nếu cần đổi chế độ dữ liệu. Truy cập địa chỉ do Vite in ra, mặc định http://localhost:5173.

Kiểm tra:

    npm run lint
    npm run typecheck
    npm run test
    npm run build
    npx playwright install chromium
    npm run test:e2e

## Tài khoản demo

Mật khẩu chung: Demo@123. Nút chọn nhanh ở trang đăng nhập sẽ điền tài khoản.

| Vai trò | Email |
| --- | --- |
| Du khách | khach@demo.vn |
| Đối tác | doitac@demo.vn |
| Admin | admin@demo.vn |

OTP đăng ký/đặt lại mật khẩu demo là 123456 và hiển thị công khai; không gửi email thật. Google OAuth bị vô hiệu hóa khi không có backend. Dữ liệu demo lưu ở localStorage, phiên đăng nhập và bản nháp lịch trình ở sessionStorage. Chọn **Đặt lại dữ liệu** trên thanh thông báo để khôi phục seed.

Seed v3 có 22 điểm đến, 8 khách sạn, 10 loại phòng, 11 nhà hàng, cùng chuyến đi, booking, đánh giá và đối soát mẫu. Lần mở đầu sau khi nâng từ seed v2 sẽ thêm các bản ghi mới vào localStorage mà giữ các bản ghi cũ đã chỉnh sửa. **Đặt lại dữ liệu** sẽ thay toàn bộ dữ liệu demo bằng seed mới.

## Cấu trúc

- src/app: router, phân quyền và layout.
- src/features: màn hình theo nghiệp vụ.
- src/services/mock: seed, kho dữ liệu và quy tắc demo.
- src/services/api: Axios adapter cho hợp đồng API đề xuất.
- src/types, src/lib, src/components, src/hooks: kiểu dữ liệu và phần dùng chung.
- e2e và các file *.test.ts: kiểm thử trình duyệt và nghiệp vụ.
- docs: luồng trang, hợp đồng API, giả định, tiến độ và DOCX nguồn.

## Module

Du khách có thể tìm kiếm điểm đến, khách sạn và nhà hàng; quản lý hồ sơ, sở thích, yêu thích; nhận gợi ý từ danh mục; tạo/lưu lịch trình demo hoặc quản lý lịch trình thủ công; đặt phòng, mô phỏng thanh toán, hủy, theo dõi hoàn tiền và đánh giá booking hoàn tất.

Đối tác quản lý loại phòng và lịch bán/giá theo ngày. Admin xác minh đối tác, quản lý danh mục/trạng thái dịch vụ, kiểm duyệt đánh giá, xem báo cáo, xử lý hoàn tiền demo và mô phỏng đối soát/chi trả.

## Chế độ API

Mặc định VITE_DATA_MODE=mock. Để dùng backend theo [hợp đồng đề xuất](docs/api-contract.md), đặt VITE_DATA_MODE=api và VITE_API_BASE_URL đến API của bạn. Ứng dụng sẽ hiển thị lỗi mạng/HTTP, không tự chuyển về mock. Backend phải thực thi xác thực, phân quyền, idempotency, khóa tồn phòng, xác minh thanh toán và bảo vệ dữ liệu. Không đặt secret trong biến VITE_* vì chúng xuất hiện trong bundle trình duyệt.

## Giới hạn demo

Gợi ý và lịch trình dùng quy tắc đơn giản trên dữ liệu có sẵn, không phải AI/LLM. VNPAY, Google OAuth, email OTP, hoàn tiền và chuyển khoản đều chưa kết nối thật. localStorage không bảo đảm giao dịch đồng thời giữa nhiều thiết bị. Ảnh dùng placeholder nội bộ để tránh phụ thuộc ảnh bên ngoài.
