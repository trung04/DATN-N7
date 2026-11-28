import { describe, expect, it } from 'vitest'
import { localizedErrorMessage } from './error-messages'
import { formatStatus } from './utils'

describe('nhãn trạng thái và thông báo tiếng Việt', () => {
  it('hiển thị đủ trạng thái vận hành phòng mà không lộ mã nội bộ', () => {
    expect(formatStatus('AVAILABLE')).toBe('Đang kinh doanh')
    expect(formatStatus('MAINTENANCE')).toBe('Đang bảo trì')
    expect(formatStatus('OUT_OF_SERVICE')).toBe('Ngừng khai thác')
    expect(formatStatus('NEW_INTERNAL_STATUS')).toBe('Chưa xác định')
  })

  it('dịch lỗi theo mã nghiệp vụ hoặc nội dung đã biết', () => {
    expect(localizedErrorMessage('Room is already booked.', 'BOOKING_ROOM_UNAVAILABLE', 409))
      .toBe('Phòng đã có khách đặt trong khoảng ngày này.')
    expect(localizedErrorMessage('No eligible paid bookings were found in this period.', undefined, 409))
      .toBe('Không có đơn đặt phòng đã thanh toán đủ điều kiện đối soát trong khoảng ngày này.')
  })

  it('giữ chi tiết nghiệp vụ tiếng Việt và dùng thông báo tiếng Việt cho lỗi chưa nhận diện', () => {
    expect(localizedErrorMessage('Giấy phép kinh doanh đã hết hạn.', 'HOTEL_SUBMISSION_INVALID', 409))
      .toBe('Giấy phép kinh doanh đã hết hạn.')
    expect(localizedErrorMessage('Unrecognized upstream failure', undefined, 503))
      .toBe('Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.')
  })
})
