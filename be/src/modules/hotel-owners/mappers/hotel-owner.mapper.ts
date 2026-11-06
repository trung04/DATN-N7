import {
  HotelOwnerListResponse,
  HotelOwnerResponse,
} from '../dtos/responses/hotel-owner.response';
import { HotelOwnerEntity } from '../entities/hotel-owner.entity';

export class HotelOwnerMapper {
  static toResponse(hotelOwner: HotelOwnerEntity): HotelOwnerResponse {
    return {
      userId: hotelOwner.userId,
      bankName: hotelOwner.bankName,
      bankAccountNumber: hotelOwner.bankAccountNumber,
      bankAccountHolder: hotelOwner.bankAccountHolder,
    };
  }

  static toListResponse(
    hotelOwners: HotelOwnerEntity[],
    page: number,
    limit: number,
    total: number,
  ): HotelOwnerListResponse {
    return {
      data: hotelOwners.map((hotelOwner) => this.toResponse(hotelOwner)),
      meta: { page, limit, total },
    };
  }
}
