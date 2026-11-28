export class RoomImageResponse {
  id: string;
  roomId: string;
  url: string;
  previewUrl: string;
  imageOrder: number;
  contentType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  sourceUrl: string | null;
  attributionText: string | null;
  illustrative: boolean;
  createdAt: string;
}
