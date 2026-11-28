export const BOOKING_SETTINGS_REPOSITORY = Symbol('BOOKING_SETTINGS_REPOSITORY');

export interface BookingSettings {
  commissionRate: number;
  updatedAt: Date | null;
}

export interface BookingSettingsRepository {
  find(): Promise<BookingSettings | null>;
  save(commissionRate: number, adminId: string): Promise<BookingSettings>;
}
