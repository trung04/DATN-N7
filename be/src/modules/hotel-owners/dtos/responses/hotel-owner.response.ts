export class HotelOwnerResponse {
  userId: string;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
}

export class HotelOwnerListResponse {
  data: HotelOwnerResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
