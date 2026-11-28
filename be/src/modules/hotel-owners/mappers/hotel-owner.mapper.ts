import {
  HotelOwnerListResponse,
  HotelOwnerResponse,
} from '../dtos/responses/hotel-owner.response';
import { HotelOwnerEntity } from '../../users/entities/hotel-owner.entity';
import { resolveBankBin } from '../catalog/vietqr-banks';

export class HotelOwnerMapper {
  static toResponse(hotelOwner: HotelOwnerEntity): HotelOwnerResponse {
    return {
      userId: hotelOwner.userId,
      bankName: hotelOwner.bankName,
      bankBin: hotelOwner.bankBin ?? (hotelOwner.bankName ? resolveBankBin(hotelOwner.bankName) : null),
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
