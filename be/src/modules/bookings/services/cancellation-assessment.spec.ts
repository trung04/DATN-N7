import {
  BookingEntity,
  BookingStatus,
  PaymentStatus,
} from '../entities/booking.entity';
import { assessCancellation } from './cancellation-assessment';

describe('assessCancellation', () => {
  it('allows cancellation of a pending unpaid reservation without a fee', () => {
    const assessment = assessCancellation(Object.assign(new BookingEntity(), {
      bookingStatus: BookingStatus.PENDING,
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
      cancellationPolicySnapshot: null,
    }));

    expect(assessment).toEqual({
      allowed: true,
      reason: null,
      feeAmount: 0,
      policyName: null,
      rule: null,
    });
  });
});
