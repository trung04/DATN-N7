import type { Itinerary, Stopover, TravelActivity } from '@/types/domain'

const overlaps = (start: string, end: string, otherStart: string, otherEnd: string) => start < otherEnd && otherStart < end

function addMinutes(value: string, minutes: number, limit: string) {
  const date = new Date(value)
  date.setMinutes(date.getMinutes() + minutes)
  const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return next < limit ? next : limit
}

function nextDate(date: string) {
  const value = new Date(`${date}T00:00`)
  value.setDate(value.getDate() + 1)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export function intervalOverlapsDay(start: string, end: string, date: string) {
  return start < `${nextDate(date)}T00:00` && end > `${date}T00:00`
}

export function stopOverlapsDay(stop: Stopover, date: string) {
  return intervalOverlapsDay(stop.start, stop.end, date)
}

export function defaultStopTimes(date: string, stops: Stopover[], activities: TravelActivity[]) {
  const dayStops = stops.filter(stop => stop.start.startsWith(date))
  const latestEnd = [...dayStops.map(stop => stop.end), ...activities.filter(activity => dayStops.some(stop => stop.id === activity.stopId)).map(activity => activity.end)].sort().at(-1)
  const start = latestEnd ?? `${date}T09:00`
  return { start, end: addMinutes(start, 120, `${date}T23:59`) }
}

export function defaultActivityTimes(stop: Stopover, activities: TravelActivity[], date = stop.start.slice(0, 10)) {
  const dayStart = `${date}T00:00`
  const dayEnd = `${date}T23:59`
  const availableStart = stop.start > dayStart ? stop.start : dayStart
  const availableEnd = stop.end < dayEnd ? stop.end : dayEnd
  const latestEnd = activities
    .filter(activity => activity.stopId === stop.id && intervalOverlapsDay(activity.start, activity.end, date))
    .map(activity => activity.end)
    .sort()
    .at(-1)
  const start = latestEnd && latestEnd > availableStart ? latestEnd : availableStart
  return { start, end: addMinutes(start, 60, availableEnd) }
}

export function validateStopSchedule(trip: Itinerary, stop: Stopover, stops: Stopover[]) {
  if (!stop.placeId && (!stop.name.trim() || !Number.isFinite(stop.lat) || !Number.isFinite(stop.lng))) return 'Vui lòng chọn một địa điểm trên bản đồ.'
  if (stop.start >= stop.end) return 'Thời gian kết thúc điểm dừng phải sau thời gian bắt đầu.'
  if (stop.start.slice(0, 10) < trip.startDate || stop.end.slice(0, 10) > trip.endDate) return 'Thời gian điểm dừng nằm ngoài lịch trình chuyến đi.'
  if (stops.some(item => item.id !== stop.id && overlaps(stop.start, stop.end, item.start, item.end))) return 'Điểm dừng bị trùng thời gian với một điểm dừng khác.'
  return null
}

export function validateActivitySchedule(stop: Stopover, activity: TravelActivity, activities: TravelActivity[]) {
  if (!activity.name.trim()) return 'Vui lòng nhập tên hoạt động.'
  if (activity.start >= activity.end) return 'Thời gian kết thúc hoạt động phải sau thời gian bắt đầu.'
  if (activity.start < stop.start || activity.end > stop.end) return 'Hoạt động phải nằm trong thời gian của điểm dừng.'
  if (activities.some(item => item.stopId === stop.id && item.id !== activity.id && overlaps(activity.start, activity.end, item.start, item.end))) return 'Hoạt động bị trùng thời gian với một hoạt động khác.'
  return null
}
