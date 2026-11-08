import { IsIn, IsOptional } from 'class-validator';
import type { VnpayLocale } from '../../interfaces/vnpay-payment-gateway.interface';

export class CreateVnpayPaymentRequest {
  @IsOptional()
  @IsIn(['vn', 'en'])
  locale: VnpayLocale = 'vn';
}
