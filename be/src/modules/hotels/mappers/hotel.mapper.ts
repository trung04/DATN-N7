import { HotelDocumentEntity } from '../entities/hotel-document.entity';
import { HotelReviewHistoryEntity } from '../entities/hotel-review-history.entity';
import { HotelEntity } from '../entities/hotel.entity';
import {
  HotelDocumentResponse,
  HotelListResponse,
  HotelResponse,
  HotelReviewHistoryResponse,
} from '../dtos/responses/hotel.response';

export class HotelMapper {
  static toResponse(hotel: HotelEntity): HotelResponse {
    return {
      id: hotel.id,
      ownerUserId: hotel.ownerUserId,
      placeId: hotel.placeId,
      name: hotel.name,
      legalName: hotel.legalName,
      taxCode: hotel.taxCode,
      description: hotel.description,
      address: hotel.address,
      phoneNumber: hotel.phoneNumber,
      email: hotel.email,
      starRating: hotel.starRating,
      checkInTime: hotel.checkInTime,
      checkOutTime: hotel.checkOutTime,
      status: hotel.status,
      submittedAt: hotel.submittedAt?.toISOString() ?? null,
      reviewedAt: hotel.reviewedAt?.toISOString() ?? null,
      reviewedBy: hotel.reviewedBy,
      rejectionReason: hotel.rejectionReason,
      documents: (hotel.documents ?? []).map((document) =>
        this.toDocumentResponse(document),
      ),
      createdAt: hotel.createdAt.toISOString(),
      updatedAt: hotel.updatedAt.toISOString(),
    };
  }

  static toListResponse(
    hotels: HotelEntity[],
    page: number,
    limit: number,
    total: number,
  ): HotelListResponse {
    return {
      data: hotels.map((hotel) => this.toResponse(hotel)),
      meta: { page, limit, total },
    };
  }

  static toDocumentResponse(
    document: HotelDocumentEntity,
  ): HotelDocumentResponse {
    return {
      id: document.id,
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      fileUrl: document.fileUrl,
      issuedAt: document.issuedAt,
      expiresAt: document.expiresAt,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }

  static toReviewHistoryResponse(
    history: HotelReviewHistoryEntity,
  ): HotelReviewHistoryResponse {
    return {
      id: history.id,
      hotelId: history.hotelId,
      actorUserId: history.actorUserId,
      action: history.action,
      reason: history.reason,
      createdAt: history.createdAt.toISOString(),
    };
  }
}
