import { HotelDocumentType } from '../../entities/hotel-document.entity';
import { HotelReviewAction } from '../../entities/hotel-review-history.entity';
import { HotelStatus } from '../../entities/hotel.entity';

export class HotelDocumentResponse {
  id: string;
  documentType: HotelDocumentType;
  documentNumber: string;
  fileUrl: string;
  issuedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class HotelResponse {
  id: string;
  ownerUserId: string;
  placeId: string | null;
  name: string;
  legalName: string;
  taxCode: string;
  description: string | null;
  address: string;
  phoneNumber: string;
  email: string;
  starRating: number | null;
  checkInTime: string;
  checkOutTime: string;
  status: HotelStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  documents: HotelDocumentResponse[];
  createdAt: string;
  updatedAt: string;
}

export class HotelListResponse {
  data: HotelResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export class HotelReviewHistoryResponse {
  id: string;
  hotelId: string;
  actorUserId: string;
  action: HotelReviewAction;
  reason: string | null;
  createdAt: string;
}
