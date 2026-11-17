export interface MapboxGeocodingResult {
  id: string
  name: string
  address: string
  featureType: string
  coordinates: [number, number]
}

export class MapboxGeocodingError extends Error {
  constructor(readonly status: number) {
    super(`Mapbox geocoding failed with HTTP ${status}.`)
    this.name = 'MapboxGeocodingError'
  }
}

interface SearchOptions {
  permanent?: boolean
  autocomplete?: boolean
  limit?: number
}

interface MapboxGeocodingFeature {
  id?: string
  geometry?: { coordinates?: unknown }
  properties?: {
    mapbox_id?: string
    name?: string
    full_address?: string
    place_formatted?: string
    feature_type?: string
  }
}

interface MapboxGeocodingResponse {
  features?: MapboxGeocodingFeature[]
}

export async function searchMapboxAddresses(
  query: string,
  token: string,
  proximity: [number, number],
  signal: AbortSignal,
  options: SearchOptions = {},
): Promise<MapboxGeocodingResult[]> {
  const params = new URLSearchParams({
    q: query,
    access_token: token,
    country: 'VN',
    language: 'vi,en',
    autocomplete: String(options.autocomplete ?? true),
    limit: String(options.limit ?? 5),
    types: 'address,street,place,locality,neighborhood',
    proximity: `${proximity[0]},${proximity[1]}`,
  })
  if (options.permanent) params.set('permanent', 'true')
  const response = await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?${params}`,
    { signal },
  )
  if (!response.ok) throw new MapboxGeocodingError(response.status)

  const payload = (await response.json()) as MapboxGeocodingResponse
  return (payload.features ?? []).flatMap((feature, index) => {
    const coordinates = feature.geometry?.coordinates
    if (
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      typeof coordinates[0] !== 'number' ||
      typeof coordinates[1] !== 'number' ||
      !Number.isFinite(coordinates[0]) ||
      !Number.isFinite(coordinates[1])
    ) {
      return []
    }

    const properties = feature.properties ?? {}
    const name = properties.name?.trim() || properties.full_address?.trim()
    if (!name) return []

    return [{
      id: properties.mapbox_id || feature.id || `mapbox-${index}`,
      name,
      address: properties.full_address || properties.place_formatted || name,
      featureType: properties.feature_type || 'location',
      coordinates: [coordinates[0], coordinates[1]] as [number, number],
    }]
  })
}

export async function searchPermanentMapboxAddress(
  query: string,
  token: string,
  proximity: [number, number],
  signal: AbortSignal,
): Promise<MapboxGeocodingResult | null> {
  const results = await searchMapboxAddresses(query, token, proximity, signal, {
    permanent: true,
    autocomplete: false,
    limit: 1,
  })
  return results[0] ?? null
}
