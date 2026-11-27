import { describe, expect, it } from 'vitest'
import { mapPlacesToGeoJson, toggleCategory } from './map-place-geojson'

describe('map place presentation data', () => {
  it('keeps only marker properties in GeoJSON', () => {
    expect(mapPlacesToGeoJson([{
      id: 'place-1',
      name: 'Cầu Rồng',
      categoryCode: 'ATTRACTION',
      categoryName: 'Điểm tham quan',
      lat: 16.061,
      lng: 108.227,
    }])).toEqual({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        id: 'place-1',
        geometry: { type: 'Point', coordinates: [108.227, 16.061] },
        properties: { id: 'place-1', name: 'Cầu Rồng', categoryCode: 'ATTRACTION', categoryName: 'Điểm tham quan' },
      }],
    })
  })

  it('toggles category filters without duplicates and keeps stable ordering', () => {
    expect(toggleCategory(['RESTAURANT'], 'ATTRACTION')).toEqual(['ATTRACTION', 'RESTAURANT'])
    expect(toggleCategory(['ATTRACTION', 'RESTAURANT'], 'ATTRACTION')).toEqual(['RESTAURANT'])
  })
})
