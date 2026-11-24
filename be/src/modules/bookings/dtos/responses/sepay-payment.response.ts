import { PaymentMethod, PaymentStatus } from '../../entities/booking.entity';

export class SePayPaymentResponse {
  bookingId: string;
  bookingCode: string;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  orderCode: string;
  vaNumber: string;
  qrCode: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountHolderName: string | null;
  expiresAt: string | null;
}
