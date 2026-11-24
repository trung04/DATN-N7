import type { Stopover } from '@/types/domain'
import { stopOverlapsDay } from './trip-schedule'

export function nextLiveStop(stops: Stopover[], date: string, completedIds: string[], activeStopId?: string) {
  const remaining = stops
    .filter(stop => stopOverlapsDay(stop, date) && !completedIds.includes(stop.id))
    .sort((a, b) => a.start.localeCompare(b.start))
  return remaining.find(stop => stop.id === activeStopId) ?? remaining[0]
}

export function distanceKm(a: [number, number], b: [number, number]) {
  const radians = (value: number) => value * Math.PI / 180
  const latitude = radians(b[1] - a[1])
  const longitude = radians(b[0] - a[0])
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(longitude / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}
