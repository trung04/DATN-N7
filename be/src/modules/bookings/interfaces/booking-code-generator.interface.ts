export const BOOKING_CODE_GENERATOR = Symbol('BOOKING_CODE_GENERATOR');

export interface BookingCodeGenerator {
  generate(now?: Date): string;
}
