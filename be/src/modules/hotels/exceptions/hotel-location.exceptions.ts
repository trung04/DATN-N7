import { DomainException } from '../../../common/exceptions/domain.exception';

export class HotelLocationUnavailableException extends DomainException {
  constructor() {
    super('Chưa tìm được địa chỉ. Vui lòng thử lại hoặc chọn vị trí trực tiếp trên bản đồ.', 'HOTEL_LOCATION_UNAVAILABLE', 'service_unavailable');
  }
}

export class HotelLocationRateLimitedException extends DomainException {
  constructor() {
    super('Dịch vụ tìm địa chỉ đang bận. Vui lòng chờ một lát rồi tìm lại.', 'HOTEL_LOCATION_RATE_LIMITED', 'rate_limited');
  }
}
