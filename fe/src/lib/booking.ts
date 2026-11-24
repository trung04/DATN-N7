import type { Booking } from '@/types/domain'

export function cancellationQuote(booking: Booking, now = Date.now()) {
  const terms = booking.policyTermsSnapshot
  const checkInTime = String(terms.checkInHour ?? 14).padStart(2, '0')
  const beforeCheckIn = (Date.parse(`${booking.checkIn}T${checkInTime}:00:00+07:00`) - now) / 3600000
  const usesHoursAfterBooking = terms.basis === 'HOURS_AFTER_BOOKING'
  const elapsedHours = usesHoursAfterBooking
    ? (now - Date.parse(booking.createdAt)) / 3600000
    : beforeCheckIn
  const allowed = beforeCheckIn > 0 && elapsedHours >= 0
  const freeHours = terms.freeForHoursAfterBooking ?? terms.freeUntilHours ?? 24
  const fee = allowed && (usesHoursAfterBooking ? elapsedHours >= freeHours : elapsedHours < freeHours)
    ? Math.round(booking.total * terms.lateFeeRate)
    : 0
  return { allowed, fee, refund: allowed ? booking.total - fee : 0 }
}
