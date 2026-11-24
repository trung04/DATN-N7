import type { ComponentProps } from 'react'
import { ItineraryMap as MapboxItineraryMap } from './itinerary-map'

export type ItineraryMapProps = ComponentProps<typeof MapboxItineraryMap>

export function ItineraryMap(props: ItineraryMapProps) {
  return <div className="h-full [&>div]:!h-full [&>div]:!max-h-none"><MapboxItineraryMap {...props} /></div>
}
