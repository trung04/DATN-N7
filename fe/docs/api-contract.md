# API contract đề xuất

**Chưa có backend.** src/services/api/client.ts là adapter Axios cho các endpoint này. Frontend gửi cookie phiên với withCredentials; backend cần cookie HttpOnly/Secure/SameSite phù hợp, CSRF protection và xác minh quyền sở hữu. Response JSON theo type trong src/types/domain.ts. Lỗi trả mã HTTP cùng JSON gồm code và message.

## Đọc dữ liệu

| Method | Endpoint | Kết quả |
| --- | --- | --- |
| GET | /catalog | Điểm đến, khách sạn, loại phòng, khả dụng theo ngày, nhà hàng, đánh giá công khai, danh mục/dịch vụ |
| GET | /users/:id/overview | Hồ sơ, sở thích, yêu thích, chuyến đi, booking/payment/refund/review của chủ tài khoản |
| GET | /partners/by-user/:id/overview | Khách sạn, phòng, lịch phòng và booking thuộc đối tác |
| GET | /admin/overview | Dữ liệu quản trị theo quyền |

Endpoint overview là đề xuất để giữ giao diện hiện tại; backend có thể tách tài nguyên phân trang khi adapter trả cùng cấu trúc.

## Thao tác

- Auth: POST /auth/login, /auth/register, /auth/verify-otp, /auth/resend-otp, /auth/forgot-password, /auth/reset-password; Google bắt đầu tại /auth/google/start.
- Du khách: PATCH /users/:id, POST /users/:id/deletion-request, PUT hoặc DELETE /users/:id/preferences, POST /users/:id/favorites/toggle; POST /ai/recommendations, POST /ai/trip-planner; CRUD /users/:id/trips, /users/:id/trips/:tripId/stops, /users/:id/stops/:stopId/activities.
- `POST /ai/trip-planner` nhận `PlannerInput` và trả `PlannerResult`. Ngoài chuyến đi, điểm dừng, hoạt động, tổng chi phí và giải thích, response có thể trả `costBreakdown` (`lodging`, `food`, `activities`), `reasons` theo ID điểm dừng và `input` để khôi phục bản nháp. Adapter API phải hiển thị lỗi backend; frontend không tự đổi sang kết quả demo.
- Booking: POST /users/:id/bookings nhận BookingInput với Idempotency-Key; POST /users/:id/bookings/:bookingId/payments; POST /users/:id/bookings/:bookingId/cancel; POST /users/:id/bookings/:bookingId/reviews. Backend tính giá, khóa tồn phòng từng đêm và xác minh callback VNPAY.
- Khi tạo booking, backend trả `policySnapshot` (mô tả) và `policyTermsSnapshot` gồm `freeUntilHours`, `lateFeeRate`, `checkInHour`; phí hủy phải tính từ bản chụp này theo giờ `Asia/Ho_Chi_Minh`.
- Đối tác: POST hoặc PUT /partners/by-user/:id/rooms; PUT /partners/by-user/:id/rooms/:roomId/inventory. Gửi revision từng ngày; 409 khi có cập nhật đồng thời hoặc số bán thấp hơn đã đặt cộng đang giữ.
- Admin: POST /admin/partners/:id/verification, POST hoặc PUT /admin/service-categories, POST /admin/services/:id/toggle, POST /admin/reviews/:id/moderation, POST /admin/settlements/:id/transition. Gửi revision khi xác minh/đối soát.

## Trạng thái

- Booking: PENDING_PAYMENT → CONFIRMED → COMPLETED; PENDING_PAYMENT → EXPIRED; CONFIRMED → CANCELLED.
- Payment: PENDING → PROCESSING → PAID hoặc FAILED; cũng có EXPIRED. Thử lại tạo payment attempt mới trên cùng booking nếu còn hạn.
- Refund: PENDING → PROCESSING → REFUNDED hoặc FAILED. Không suy ra REFUNDED từ trạng thái booking.
- Settlement: DRAFT → APPROVED → PROCESSING → PAID hoặc FAILED; FAILED có thể kiểm tra rồi duyệt thử lại.

Backend phải thực thi các quy tắc bằng giao dịch dữ liệu, phân quyền và idempotency; kiểm tra frontend chỉ phục vụ trải nghiệm.
