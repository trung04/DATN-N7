import type { Booking } from '@/types/domain'

export function cancellationQuote(booking: Booking, now = Date.now()) {
  const terms = booking.policyTermsSnapshot
  const checkInTime = String(terms.checkInHour).padStart(2, '0')
  const hoursUntilCheckIn = (Date.parse(`${booking.checkIn}T${checkInTime}:00:00+07:00`) - now) / 3600000
  const allowed = hoursUntilCheckIn > 0
  const fee = allowed && hoursUntilCheckIn < terms.freeUntilHours ? Math.round(booking.total * terms.lateFeeRate) : 0
  return { allowed, fee, refund: allowed ? booking.total - fee : 0 }
}
