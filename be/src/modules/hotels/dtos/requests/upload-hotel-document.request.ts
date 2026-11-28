import { OmitType } from '@nestjs/swagger';
import { CreateHotelDocumentRequest } from './create-hotel-document.request';

export class UploadHotelDocumentRequest extends OmitType(CreateHotelDocumentRequest, ['fileUrl'] as const) {}
