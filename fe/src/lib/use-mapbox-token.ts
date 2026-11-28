import { useQuery } from '@tanstack/react-query'
import { isMock } from '@/services'
import { api } from '@/services/api/client'

export const mapSettingsQueryKey = ['public-map-settings'] as const

export function useMapboxToken() {
  const settings = useQuery({ queryKey: mapSettingsQueryKey, queryFn: api.publicMapSettings, enabled: !isMock, staleTime: 60_000 })
  return settings.data?.mapboxToken ?? import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()
}
