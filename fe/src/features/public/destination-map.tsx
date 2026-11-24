import { useEffect, useRef, useState } from 'react'
import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { hasValidCoordinates } from '@/lib/coordinates'

const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()

export interface MapLocation {
  id: string
  name: string
  city: string
  region?: string
  lat?: number
  lng?: number
}

export function DestinationMap({ place, emptyMessage = 'Địa điểm này chưa có tọa độ bản đồ.' }: { place: MapLocation; emptyMessage?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const [error, setError] = useState('')
  const [mapLoaded, setMapLoaded] = useState(false)
  const hasCoordinates = hasValidCoordinates(place.lat, place.lng)
  const staticMapUrl = hasCoordinates && token
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+1E3A5F(${place.lng},${place.lat})/${place.lng},${place.lat},14,0/1200x560@2x?access_token=${encodeURIComponent(token)}`
    : null

  useEffect(() => {
    if (!token || !hasCoordinates || !containerRef.current) return

    setError('')
    setMapLoaded(false)
    if (!mapboxgl.supported()) {
      setError('Trình duyệt không hỗ trợ WebGL; đang hiển thị bản đồ tĩnh của địa điểm.')
      return
    }

    mapboxgl.accessToken = token
    let map: MapboxMap
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [place.lng!, place.lat!],
        zoom: 14,
        cooperativeGestures: true,
      })
    } catch (mapError) {
      console.error('Mapbox destination map initialization error:', mapError)
      setError('Không khởi tạo được bản đồ tương tác; đang hiển thị bản đồ tĩnh của địa điểm.')
      return
    }

    mapRef.current = map
    let loaded = false
    map.once('load', () => {
      loaded = true
      setMapLoaded(true)
      setError('')
    })
    map.on('error', event => {
      console.error('Mapbox destination map error:', event.error)
      if (!loaded) setError('Mapbox chưa tải được bản đồ tương tác; đang hiển thị bản đồ tĩnh của địa điểm.')
    })

    const marker = new mapboxgl.Marker({ color: '#1E3A5F' })
      .setLngLat([place.lng!, place.lat!])
      .setPopup(new mapboxgl.Popup({ offset: 24 }).setText(place.name))
      .addTo(map)
    markerRef.current = marker
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    const element = containerRef.current
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(element)
    const loadTimeout = window.setTimeout(() => {
      if (!loaded) setError('Mapbox tải quá lâu; đang hiển thị bản đồ tĩnh của địa điểm.')
    }, 12000)

    return () => {
      window.clearTimeout(loadTimeout)
      observer.disconnect()
      marker.remove()
      map.remove()
      markerRef.current = null
      mapRef.current = null
    }
  }, [hasCoordinates, place.id, place.lat, place.lng, place.name])

  return <section className="mt-10">
    <h2 className="mb-4 text-2xl font-semibold text-[#1E3A5F]">Vị trí</h2>
    {!hasCoordinates ? <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600">{emptyMessage}</div>
      : !token ? <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600">Bản đồ chưa được cấu hình.</div>
        : <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {staticMapUrl && <img src={staticMapUrl} alt={`Bản đồ vị trí ${place.name}`} className="absolute inset-0 h-full w-full object-cover" onError={() => setError('Không tải được ảnh bản đồ dự phòng. Hãy kiểm tra kết nối tới Mapbox.')} />}
          <div ref={containerRef} className="h-full w-full transition-opacity duration-300" style={{ opacity: mapLoaded ? 1 : 0 }} aria-label={`Bản đồ vị trí ${place.name}`} />
          {error && <div role="alert" className="absolute inset-x-4 top-4 z-10 rounded-lg border border-amber-200 bg-white/95 p-3 text-sm text-amber-800">{error}</div>}
          <p className="absolute bottom-3 left-3 z-10 rounded-md bg-white/95 px-3 py-2 text-xs text-slate-600 shadow">{place.region ? `${place.region}, ` : ''}{place.city} · © Mapbox</p>
        </div>}
  </section>
}
