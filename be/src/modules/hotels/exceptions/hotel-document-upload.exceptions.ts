import { DomainException } from '../../../common/exceptions/domain.exception';

export class InvalidHotelDocumentImagesException extends DomainException {
  constructor() {
    super('Chọn từ 1 đến 3 ảnh JPEG, PNG hoặc WebP, mỗi ảnh tối đa 5 MiB.', 'HOTEL_DOCUMENT_IMAGES_INVALID', 'validation');
  }
}
