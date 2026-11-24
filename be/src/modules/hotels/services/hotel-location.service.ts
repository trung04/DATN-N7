import { Inject, Injectable } from '@nestjs/common';
import { HOTEL_GEOCODER, type HotelGeocoder } from '../interfaces/hotel-geocoder.interface';

@Injectable()
export class HotelLocationService {
  constructor(@Inject(HOTEL_GEOCODER) private readonly geocoder: HotelGeocoder) {}

  search(query: string) {
    return this.geocoder.search(query.trim().replace(/\s+/g, ' '));
  }
}
