import type { Itinerary, Stopover, TravelActivity } from '@/types/domain'

const overlaps = (start: string, end: string, otherStart: string, otherEnd: string) => start < otherEnd && otherStart < end

function addMinutes(value: string, minutes: number, limit: string) {
  const [date = '', time = '00:00'] = value.split('T')
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  const total = hour * 60 + minute + minutes
  const next = `${date}T${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  return next < limit ? next : limit
}

export function defaultStopTimes(date: string, stops: Stopover[], activities: TravelActivity[]) {
  const dayStops = stops.filter(stop => stop.start.startsWith(date))
  const latestEnd = [...dayStops.map(stop => stop.end), ...activities.filter(activity => dayStops.some(stop => stop.id === activity.stopId)).map(activity => activity.end)].sort().at(-1)
  const start = latestEnd ?? `${date}T09:00`
  return { start, end: addMinutes(start, 120, `${date}T23:59`) }
}

export function defaultActivityTimes(stop: Stopover, activities: TravelActivity[]) {
  const start = activities.filter(activity => activity.stopId === stop.id).map(activity => activity.end).sort().at(-1) ?? stop.start
  return { start, end: addMinutes(start, 60, stop.end) }
}

export function validateStopSchedule(trip: Itinerary, stop: Stopover, stops: Stopover[]) {
  if (!stop.placeId && (!stop.name.trim() || !Number.isFinite(stop.lat) || !Number.isFinite(stop.lng))) return 'Vui lòng chọn một địa điểm trên bản đồ.'
  if (stop.start >= stop.end) return 'Thời gian kết thúc điểm dừng phải sau thời gian bắt đầu.'
  if (stop.start.slice(0, 10) !== stop.end.slice(0, 10)) return 'Điểm dừng phải bắt đầu và kết thúc trong cùng một ngày.'
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
