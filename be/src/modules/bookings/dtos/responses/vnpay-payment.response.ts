import { PaymentMethod, PaymentStatus } from '../../entities/booking.entity';

export class VnpayPaymentResponse {
  bookingId: string;
  bookingCode: string;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  paymentUrl: string;
  expiresAt: string;
}

export class VnpayIpnResponse {
  RspCode: string;
  Message: string;
}

export class VnpayReturnResponse {
  signatureValid: boolean;
  bookingId: string | null;
  bookingCode: string | null;
  paymentStatus: PaymentStatus | null;
  responseCode: string | null;
  transactionStatus: string | null;
}
