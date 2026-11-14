import {
  BookingCancellationRuleSnapshot,
  BookingEntity,
  PaymentStatus,
  BookingStatus,
} from '../entities/booking.entity';

export interface CancellationAssessment {
  allowed: boolean;
  reason: string | null;
  feeAmount: number | null;
  policyName: string | null;
  rule: BookingCancellationRuleSnapshot | null;
}

export function assessCancellation(
  booking: BookingEntity,
  now: Date = new Date(),
): CancellationAssessment {
  // An unpaid reservation is only holding inventory. Let the guest release it
  // without applying the monetary cancellation terms for a paid stay.
  if (
    booking.bookingStatus === BookingStatus.PENDING &&
    booking.paymentStatus !== PaymentStatus.PAID
  ) {
    return {
      allowed: true,
      reason: null,
      feeAmount: 0,
      policyName: booking.cancellationPolicySnapshot?.policyName ?? null,
      rule: null,
    };
  }

  if (booking.bookingStatus !== BookingStatus.CONFIRMED) {
    return {
      allowed: false,
      reason: 'Chỉ có thể hủy booking đã xác nhận.',
      feeAmount: null,
      policyName: null,
      rule: null,
    };
  }
  const snapshot = booking.cancellationPolicySnapshot;
  if (!snapshot) {
    return {
      allowed: false,
      reason: 'Booking cũ chưa lưu điều khoản hủy. Vui lòng liên hệ khách sạn để được hỗ trợ.',
      feeAmount: null,
      policyName: null,
      rule: null,
    };
  }

  const checkInAt = new Date(
    `${booking.checkInDate}T${snapshot.checkInTime}+07:00`,
  );
  if (now.getTime() >= checkInAt.getTime()) {
    return {
      allowed: false,
      reason: 'Không thể hủy sau giờ nhận phòng.',
      feeAmount: null,
      policyName: null,
      rule: null,
    };
  }

  const usesHoursAfterBooking = snapshot.basis === 'HOURS_AFTER_BOOKING';
  const elapsedHours = usesHoursAfterBooking
    ? (now.getTime() - booking.createdAt.getTime()) / 3_600_000
    : (checkInAt.getTime() - now.getTime()) / 3_600_000;
  if (elapsedHours < 0) {
    return {
      allowed: false,
      reason: 'Thời điểm hủy không hợp lệ với booking này.',
      feeAmount: null,
      policyName: null,
      rule: null,
    };
  }

  if (usesHoursAfterBooking && snapshot.cancelHours !== undefined) {
    const isFreePeriod = elapsedHours < snapshot.cancelHours;
    const rule: BookingCancellationRuleSnapshot = {
      id: snapshot.rules[0]?.id ?? booking.cancellationPolicyId ?? 'snapshot',
      name: snapshot.policyName ?? snapshot.rules[0]?.name ?? 'Chính sách hủy',
      cancelHours: snapshot.cancelHours,
      penaltyPercent: snapshot.penaltyPercent ?? 0,
      minHoursAfterBooking: 0,
      maxHoursAfterBooking: null,
      cancellationAllowed: snapshot.cancellationAllowed ?? true,
      cancellationFeeRate: isFreePeriod ? 0 : snapshot.penaltyPercent ?? 0,
      description: snapshot.policyDescription ?? snapshot.rules[0]?.description ?? null,
    };
    if (!rule.cancellationAllowed) {
      return {
        allowed: false,
        reason: rule.description || `Theo chính sách “${rule.name}”, booking không được hủy.`,
        feeAmount: null,
        policyName: rule.name,
        rule,
      };
    }
    return {
      allowed: true,
      reason: null,
      feeAmount: Math.round(booking.amount * (rule.cancellationFeeRate ?? 0) / 100 + Number.EPSILON),
      policyName: rule.name,
      rule,
    };
  }

  const matchedRule = snapshot.rules.find((item) => {
    const minHours = usesHoursAfterBooking
      ? item.minHoursAfterBooking
      : item.minHoursBeforeCheckIn;
    const maxHours = usesHoursAfterBooking
      ? item.maxHoursAfterBooking
      : item.maxHoursBeforeCheckIn;
    return elapsedHours >= (minHours ?? 0) &&
      (maxHours === null || maxHours === undefined || elapsedHours < maxHours);
  });
  if (!matchedRule) {
    return {
      allowed: false,
      reason: 'Điều khoản hủy đã lưu không bao phủ thời điểm hiện tại. Vui lòng liên hệ khách sạn.',
      feeAmount: null,
      policyName: null,
      rule: null,
    };
  }

  const rule: BookingCancellationRuleSnapshot = {
    ...matchedRule,
    minHoursAfterBooking: matchedRule.minHoursAfterBooking ??
      matchedRule.minHoursBeforeCheckIn ?? 0,
    maxHoursAfterBooking: matchedRule.maxHoursAfterBooking ??
      matchedRule.maxHoursBeforeCheckIn ?? null,
  };
  if (!rule.cancellationAllowed) {
    return {
      allowed: false,
      reason: rule.description || `Theo chính sách “${rule.name}”, booking không được hủy trong khoảng thời gian này.`,
      feeAmount: null,
      policyName: rule.name,
      rule,
    };
  }
  const rate = rule.cancellationFeeRate ?? 0;
  return {
    allowed: true,
    reason: null,
    feeAmount: Math.round(booking.amount * rate / 100 + Number.EPSILON),
    policyName: rule.name,
    rule,
  };
}
