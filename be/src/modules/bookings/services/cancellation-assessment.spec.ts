import {
  BookingEntity,
  BookingStatus,
  PaymentStatus,
} from '../entities/booking.entity';
import { assessCancellation } from './cancellation-assessment';

describe('assessCancellation', () => {
  const createdAt = new Date('2026-12-01T02:00:00.000Z');
  const bookingWithTiers = (finalFee: number | null): BookingEntity => Object.assign(new BookingEntity(), {
    bookingStatus: BookingStatus.CONFIRMED,
    paymentStatus: PaymentStatus.PAID,
    amount: 1_000_000,
    createdAt,
    checkInDate: '2026-12-12',
    cancellationPolicySnapshot: {
      version: 'saved',
      basis: 'HOURS_AFTER_BOOKING',
      inclusiveHourLimits: true,
      timezone: 'Asia/Ho_Chi_Minh',
      checkInTime: '14:00:00',
      rules: [
        { minHoursAfterBooking: 0, maxHoursAfterBooking: 32, cancellationFeeRate: 0 },
        { minHoursAfterBooking: 32, maxHoursAfterBooking: 45, cancellationFeeRate: 16 },
        { minHoursAfterBooking: 45, maxHoursAfterBooking: 72, cancellationFeeRate: 20 },
        { minHoursAfterBooking: 72, maxHoursAfterBooking: null, cancellationFeeRate: finalFee },
      ].map((rule, index) => ({
        ...rule,
        id: String(index),
        name: 'Nhiều mốc',
        cancellationAllowed: rule.cancellationFeeRate !== null,
        description: null,
      })),
    },
  });

  it.each([
    [0, 0, 0],
    [32, 0, 0],
    [32, 1, 160_000],
    [45, 0, 160_000],
    [45, 1, 200_000],
    [72, 0, 200_000],
    [72, 1, 350_000],
  ])('applies the inclusive boundary at %i hours and %i milliseconds', (hours, milliseconds, feeAmount) => {
    const time = new Date(createdAt.getTime() + hours * 3_600_000 + milliseconds);
    expect(assessCancellation(bookingWithTiers(35), time)).toMatchObject({ allowed: true, feeAmount });
  });

  it('disallows cancellation after the last hour if the saved policy says so', () => {
    const time = new Date(createdAt.getTime() + 72 * 3_600_000 + 1);
    expect(assessCancellation(bookingWithTiers(null), time)).toMatchObject({ allowed: false, feeAmount: null });
  });

  it('preserves the exclusive free-period boundary of an older booking', () => {
    const oldBooking = bookingWithTiers(35);
    const snapshot = oldBooking.cancellationPolicySnapshot!;
    oldBooking.cancellationPolicySnapshot = { ...snapshot, inclusiveHourLimits: undefined, cancelHours: 32, penaltyPercent: 35 };
    const boundary = new Date(createdAt.getTime() + 32 * 3_600_000);
    expect(assessCancellation(oldBooking, boundary)).toMatchObject({ allowed: true, feeAmount: 350_000 });
  });

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
