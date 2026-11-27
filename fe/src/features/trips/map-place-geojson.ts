import type { FeatureCollection, Point } from 'geojson'
import type { MapPlacePoint } from '@/types/domain'

type MapPlaceProperties = Pick<MapPlacePoint, 'id' | 'name' | 'categoryCode' | 'categoryName'>

export function mapPlacesToGeoJson(
  places: MapPlacePoint[],
): FeatureCollection<Point, MapPlaceProperties> {
  return {
    type: 'FeatureCollection',
    features: places.map(place => ({
      type: 'Feature',
      id: place.id,
      geometry: { type: 'Point', coordinates: [place.lng, place.lat] },
      properties: {
        id: place.id,
        name: place.name,
        categoryCode: place.categoryCode,
        categoryName: place.categoryName,
      },
    })),
  }
}

export function toggleCategory(selected: string[], categoryCode: string): string[] {
  return (selected.includes(categoryCode)
    ? selected.filter(code => code !== categoryCode)
    : [...selected, categoryCode]
  ).sort()
}
