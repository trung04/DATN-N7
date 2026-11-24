export const HOTEL_GEOCODER = Symbol('HOTEL_GEOCODER');

export interface HotelLocationResult {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface HotelGeocoder {
  search(query: string): Promise<HotelLocationResult[]>;
}
