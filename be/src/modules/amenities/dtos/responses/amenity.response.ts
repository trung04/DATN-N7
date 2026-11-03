export class AmenityResponse {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export class AmenityListResponse {
  data: AmenityResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
