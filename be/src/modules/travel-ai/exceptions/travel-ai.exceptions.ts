import { DomainException } from '../../../common/exceptions/domain.exception';

const failures = {
  configuration: [
    'AI_UNAVAILABLE',
    'Dịch vụ AI chưa được cấu hình.',
    'service_unavailable',
  ],
  unavailable: [
    'AI_UNAVAILABLE',
    'Dịch vụ AI hoặc dữ liệu lập lịch tạm thời chưa sẵn sàng.',
    'service_unavailable',
  ],
  throttled: [
    'AI_RATE_LIMITED',
    'Dịch vụ AI đang bận. Vui lòng thử lại sau.',
    'rate_limited',
  ],
  timeout: [
    'AI_TIMEOUT',
    'Dịch vụ AI phản hồi quá thời gian chờ.',
    'gateway_timeout',
  ],
  upstream: [
    'AI_UPSTREAM_ERROR',
    'Kết nối tới dịch vụ AI gặp lỗi.',
    'bad_gateway',
  ],
  invalid: [
    'AI_INVALID_RESPONSE',
    'Dịch vụ AI trả dữ liệu chưa hợp lệ.',
    'bad_gateway',
  ],
  noPlan: [
    'AI_NO_TRIP_PLAN',
    'Chưa tạo được lịch phù hợp. Hãy kiểm tra dữ liệu địa điểm hoặc đổi yêu cầu.',
    'validation',
  ],
  catalog: [
    'AI_CATALOG_OUT_OF_SYNC',
    'Danh mục AI chưa khớp với danh mục địa điểm của ứng dụng.',
    'service_unavailable',
  ],
} as const;

export class TravelAiException extends DomainException {
  constructor(failure: keyof typeof failures) {
    const [code, message, category] = failures[failure];
    super(message, code, category);
  }
}
