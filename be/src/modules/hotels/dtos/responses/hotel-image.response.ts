export class HotelImageResponse {
  id: string;
  hotelId: string;
  url: string;
  previewUrl: string;
  contentType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  imageOrder: number;
  sourceUrl: string | null;
  attributionText: string | null;
  illustrative: boolean;
}
