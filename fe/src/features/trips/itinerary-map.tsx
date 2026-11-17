import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl'
import { Search, X } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Feature, LineString } from 'geojson'
import type { Destination, Stopover } from '@/types/domain'
import { MapboxGeocodingError, searchMapboxAddresses, searchPermanentMapboxAddress, type MapboxGeocodingResult } from '@/lib/mapbox-geocoding'

const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()

type Coordinates = [number, number]

function coordinates(place: Destination): Coordinates | null {
  return Number.isFinite(place.lat) && Number.isFinite(place.lng) ? [place.lng!, place.lat!] : null
}

export function ItineraryMap({
  city,
  places,
  stops,
  activeStopId,
  onMapClick,
  onChoosePlace,
  onSelectStop,
}: {
  city: string
  places: Destination[]
  stops: Stopover[]
  activeStopId?: string
  onMapClick: (point: Coordinates, customStopName?: string, customStopAddress?: string) => void
  onChoosePlace: (place: Destination) => void
  onSelectStop: (stopId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const searchMarkerRef = useRef<Marker | null>(null)
  const pendingCustomStopNameRef = useRef<string | null>(null)
  const onMapClickRef = useRef(onMapClick)
  const onChoosePlaceRef = useRef(onChoosePlace)
  const onSelectStopRef = useRef(onSelectStop)
  onMapClickRef.current = onMapClick
  onChoosePlaceRef.current = onChoosePlace
  onSelectStopRef.current = onSelectStop
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mapboxResults, setMapboxResults] = useState<MapboxGeocodingResult[]>([])
  const [mapboxSearching, setMapboxSearching] = useState(false)
  const [mapboxSearchError, setMapboxSearchError] = useState('')
  const [selectedMapboxResult, setSelectedMapboxResult] = useState<MapboxGeocodingResult | null>(null)
  const [selectedMapboxSearchText, setSelectedMapboxSearchText] = useState('')
  const [selectingCustomStop, setSelectingCustomStop] = useState(false)
  const [permanentSearchError, setPermanentSearchError] = useState('')
  const [resolvingPermanentSearch, setResolvingPermanentSearch] = useState(false)

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    if (!query) return []
    return places.filter(place => {
      if (!coordinates(place)) return false
      const searchable = `${place.name} ${place.city} ${place.region} ${place.category} ${place.tags.join(' ')}`
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
      return searchable.includes(query)
    }).slice(0, 7)
  }, [places, searchQuery])

  const chooseSearchResult = (place: Destination) => {
    const point = coordinates(place)
    if (!point) return
    searchMarkerRef.current?.remove()
    searchMarkerRef.current = null
    setSelectedMapboxResult(null)
    setSearchQuery(place.name)
    setSearchOpen(false)
    mapRef.current?.flyTo({ center: point, zoom: 15, duration: 700 })
    onChoosePlaceRef.current(place)
    const stop = stops.find(item => item.placeId === place.id)
    if (stop) onSelectStopRef.current(stop.id)
  }

  const chooseMapboxResult = (result: MapboxGeocodingResult) => {
    const map = mapRef.current
    if (!map) return
    setSelectedMapboxSearchText(searchQuery.trim() || result.name)
    setSearchQuery(result.name)
    setSearchOpen(false)
    setMapboxResults([])
    setMapboxSearchError('')
    setSelectedMapboxResult(result)
    map.flyTo({ center: result.coordinates, zoom: 15, duration: 700 })
    searchMarkerRef.current?.remove()
    searchMarkerRef.current = new mapboxgl.Marker({ color: '#D97706' })
      .setLngLat(result.coordinates)
      .addTo(map)
  }

  const startCustomStopPin = () => {
    pendingCustomStopNameRef.current = selectedMapboxSearchText
    setSelectingCustomStop(true)
    setPermanentSearchError('')
  }

  const addSelectedMapboxResultAsStop = async () => {
    if (!token || !selectedMapboxResult || resolvingPermanentSearch) return
    setResolvingPermanentSearch(true)
    setPermanentSearchError('')
    try {
      const result = await searchPermanentMapboxAddress(
        selectedMapboxSearchText || selectedMapboxResult.name,
        token,
        selectedMapboxResult.coordinates,
        new AbortController().signal,
      )
      if (!result) {
        setPermanentSearchError('Mapbox không trả về địa chỉ có thể lưu. Bạn có thể ghim vị trí và nhập tên, địa chỉ thủ công.')
        return
      }
      setSelectedMapboxResult(null)
      setSearchQuery(result.name)
      searchMarkerRef.current?.setLngLat(result.coordinates)
      mapRef.current?.flyTo({ center: result.coordinates, zoom: 15, duration: 500 })
      onMapClickRef.current(result.coordinates, result.name, result.address)
    } catch (error) {
      const status = error instanceof MapboxGeocodingError ? error.status : null
      setPermanentSearchError(status === 401 || status === 403
        ? 'Mapbox từ chối yêu cầu lưu vĩnh viễn. Kiểm tra quyền Geocoding và billing; bạn vẫn có thể ghim rồi nhập tên, địa chỉ thủ công.'
        : status === 429
          ? 'Mapbox đang giới hạn yêu cầu lưu vĩnh viễn (HTTP 429). Bạn vẫn có thể ghim rồi nhập tên, địa chỉ thủ công.'
          : 'Chưa xác nhận được tên và địa chỉ để lưu. Bạn vẫn có thể ghim rồi nhập thông tin thủ công.')
    } finally {
      setResolvingPermanentSearch(false)
    }
  }

  const initialCenter = useMemo<Coordinates>(() => {
    const points = places.map(coordinates).filter((point): point is Coordinates => point !== null)
    if (points.length) return [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ]
    const cityCenters: Record<string, Coordinates> = {
      'Đà Nẵng': [108.2022, 16.0544],
      'Hà Nội': [105.8342, 21.0278],
      'Huế': [107.5909, 16.4637],
      'Đà Lạt': [108.4583, 11.9404],
      'Nha Trang': [109.1967, 12.2388],
      'Hồ Chí Minh': [106.6297, 10.8231],
    }
    return cityCenters[city] ?? [106.5, 16]
  }, [city, places])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!token || !searchOpen || query.length < 3) {
      setMapboxResults([])
      setMapboxSearchError('')
      setMapboxSearching(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const center = mapRef.current?.getCenter()
      const proximity: [number, number] = center
        ? [center.lng, center.lat]
        : initialCenter
      setMapboxSearching(true)
      setMapboxSearchError('')
      void searchMapboxAddresses(query, token, proximity, controller.signal)
        .then(setMapboxResults)
        .catch(error => {
          if (controller.signal.aborted) return
          setMapboxResults([])
          setMapboxSearchError(error instanceof Error ? error.message : 'Không thể tìm địa chỉ trên Mapbox.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setMapboxSearching(false)
        })
    }, 450)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [searchQuery, searchOpen, initialCenter])

  useEffect(() => {
    if (!token || !containerRef.current) return
    setMapReady(false)
    setMapError('')
    mapboxgl.accessToken = token
    let map: MapboxMap
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: initialCenter,
        zoom: 10,
        cooperativeGestures: true,
      })
    } catch {
      setMapError('Không thể khởi tạo bản đồ. Kiểm tra Mapbox access token.')
      return
    }
    mapRef.current = map
    const loadTimer = window.setTimeout(() => {
      if (!map.loaded()) setMapError('Bản đồ tải quá lâu. Kiểm tra kết nối mạng, quyền token Mapbox và WebGL của trình duyệt.')
    }, 12000)
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(containerRef.current)
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      window.clearTimeout(loadTimer)
      map.resize()
      setMapReady(true)
    })
    map.on('error', event => {
      console.error('Mapbox map error:', event.error)
      setMapError('Mapbox không tải được bản đồ. Kiểm tra quyền truy cập token, kết nối mạng và WebGL.')
    })
    map.on('click', event => {
      const customStopName = pendingCustomStopNameRef.current
      if (customStopName) {
        pendingCustomStopNameRef.current = null
        setSelectingCustomStop(false)
        setSelectedMapboxResult(null)
        onMapClickRef.current([event.lngLat.lng, event.lngLat.lat], customStopName)
        return
      }
      onMapClickRef.current([event.lngLat.lng, event.lngLat.lat])
    })
    requestAnimationFrame(() => map.resize())
    return () => {
      window.clearTimeout(loadTimer)
      resizeObserver.disconnect()
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []
      searchMarkerRef.current?.remove()
      searchMarkerRef.current = null
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [initialCenter])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    const stopByPlaceId = new Map(stops.filter(stop => stop.placeId).map(stop => [stop.placeId!, stop]))
    for (const place of places) {
      const point = coordinates(place)
      if (!point) continue
      const stop = stopByPlaceId.get(place.id)
      const markerElement = document.createElement('button')
      markerElement.type = 'button'
      markerElement.className = stop ? 'itinerary-map-marker itinerary-map-marker-stop' : 'itinerary-map-marker itinerary-map-marker-place'
      markerElement.setAttribute('aria-label', stop ? `Điểm dừng: ${place.name}` : `Chọn ${place.name}`)
      markerElement.title = place.name
      markerElement.textContent = stop ? String(stops.indexOf(stop) + 1) : ''
      markerElement.addEventListener('click', event => {
        event.stopPropagation()
        onChoosePlaceRef.current(place)
        if (stop) onSelectStopRef.current(stop.id)
      })
      markersRef.current.push(new mapboxgl.Marker({ element: markerElement, anchor: stop ? 'bottom' : 'center' }).setLngLat(point).addTo(map))
    }

    stops.filter(stop => !stop.placeId && Number.isFinite(stop.lat) && Number.isFinite(stop.lng)).forEach(stop => {
      const markerElement = document.createElement('button')
      markerElement.type = 'button'
      markerElement.className = 'itinerary-map-marker itinerary-map-marker-stop'
      markerElement.setAttribute('aria-label', `Điểm dừng: ${stop.name}`)
      markerElement.title = stop.name
      markerElement.textContent = String(stops.indexOf(stop) + 1)
      markerElement.addEventListener('click', event => {
        event.stopPropagation()
        onSelectStopRef.current(stop.id)
      })
      markersRef.current.push(new mapboxgl.Marker({ element: markerElement, anchor: 'bottom' }).setLngLat([stop.lng!, stop.lat!]).addTo(map))
    })

    const stopCoordinates = stops.flatMap(stop => {
      if (!stop.placeId && Number.isFinite(stop.lat) && Number.isFinite(stop.lng)) return [[stop.lng!, stop.lat!] as Coordinates]
      const place = places.find(item => item.id === stop.placeId)
      const point = place && coordinates(place)
      return point ? [point] : []
    })
    const routeData: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: stopCoordinates },
    }
    const source = map.getSource('itinerary-route') as mapboxgl.GeoJSONSource | undefined
    if (source) source.setData(routeData)
    else {
      map.addSource('itinerary-route', { type: 'geojson', data: routeData })
      map.addLayer({ id: 'itinerary-route-line', type: 'line', source: 'itinerary-route', paint: { 'line-color': '#1E3A5F', 'line-width': 3, 'line-opacity': 0.8, 'line-dasharray': [2, 1.5] } })
    }

    const boundsPoints = stopCoordinates.length
      ? stopCoordinates
      : places.map(coordinates).filter((point): point is Coordinates => point !== null)
    if (!activeStopId && boundsPoints.length) {
      if (boundsPoints.length === 1) map.flyTo({ center: boundsPoints[0], zoom: 13, duration: 700 })
      else {
        const bounds = new mapboxgl.LngLatBounds()
        boundsPoints.forEach(point => bounds.extend(point))
        map.fitBounds(bounds, { padding: 64, maxZoom: 13, duration: 700 })
      }
    }
  }, [places, stops, mapReady, activeStopId])

  useEffect(() => {
    if (!activeStopId) return
    const stop = stops.find(item => item.id === activeStopId)
    const place = places.find(item => item.id === stop?.placeId)
    const point = stop && !stop.placeId && Number.isFinite(stop.lat) && Number.isFinite(stop.lng)
      ? [stop.lng!, stop.lat!] as Coordinates
      : place && coordinates(place)
    if (point) mapRef.current?.flyTo({ center: point, zoom: 14, duration: 700 })
  }, [activeStopId, places, stops])

  if (!token) return <div className="flex h-full min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
    <h2 className="text-lg font-semibold text-[#1E3A5F]">Cần cấu hình Mapbox</h2>
    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Thêm <code className="rounded bg-white px-1.5 py-1">VITE_MAPBOX_ACCESS_TOKEN</code> vào <code className="rounded bg-white px-1.5 py-1">fe/.env</code>, sau đó khởi động lại frontend.</p>
  </div>

  return <div className="relative h-[72vh] min-h-[420px] max-h-[760px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
    <div ref={containerRef} className="h-full w-full" aria-label={`Bản đồ lịch trình tại ${city}`} />
    <div className="absolute left-3 right-14 top-3 z-20 max-w-lg" onBlur={event => { const target = event.relatedTarget; if (!(target instanceof Node) || !event.currentTarget.contains(target)) setSearchOpen(false) }}>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-3.5 text-slate-500" />
        <input
          value={searchQuery}
          onChange={event => { setSearchQuery(event.target.value); setSearchOpen(true); setSelectedMapboxResult(null); searchMarkerRef.current?.remove(); searchMarkerRef.current = null }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={event => { if (event.key === 'Escape') setSearchOpen(false); if (event.key === 'Enter' && searchResults[0]) { event.preventDefault(); chooseSearchResult(searchResults[0]) } }}
          placeholder="Tìm điểm đến hoặc địa chỉ trên bản đồ"
          aria-label="Tìm địa điểm trên bản đồ"
          aria-expanded={searchOpen && Boolean(searchQuery.trim())}
          className="!mt-0 !h-11 !w-full !rounded-xl !border-slate-200 !bg-white/95 !pl-10 !pr-10 shadow-lg"
        />
        {searchQuery && <button type="button" aria-label="Xóa nội dung tìm kiếm" className="absolute right-3 top-3 rounded p-0.5 text-slate-500 hover:bg-slate-100" onClick={() => { setSearchQuery(''); setSearchOpen(true); setSelectedMapboxResult(null); searchMarkerRef.current?.remove(); searchMarkerRef.current = null }}><X size={17} /></button>}
      </div>
      {searchOpen && searchQuery.trim() && <div role="listbox" className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        {searchResults.length > 0 && <>
          <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Địa điểm trong danh mục</p>
          {searchResults.map(place => <button key={place.id} type="button" role="option" aria-selected="false" className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50" onMouseDown={event => event.preventDefault()} onClick={() => chooseSearchResult(place)}>
            <span className="block truncate text-sm font-semibold text-slate-800">{place.name}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">{place.region ? `${place.region}, ` : ''}{place.city}</span>
          </button>)}
        </>}
        <>
          <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Địa chỉ và khu vực · Mapbox</p>
          {searchQuery.trim().length < 3 && <p className="px-4 py-3 text-sm text-slate-500">Nhập thêm {3 - searchQuery.trim().length} ký tự để tìm địa chỉ và khu vực trên Mapbox.</p>}
          {searchQuery.trim().length >= 3 && mapboxSearching && <p className="px-4 py-3 text-sm text-slate-500">Đang tìm địa chỉ...</p>}
          {searchQuery.trim().length >= 3 && !mapboxSearching && mapboxSearchError && <p className="px-4 py-3 text-sm text-amber-700">{mapboxSearchError}</p>}
          {searchQuery.trim().length >= 3 && !mapboxSearching && !mapboxSearchError && mapboxResults.map(result => <button key={result.id} type="button" role="option" aria-selected="false" className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50" onMouseDown={event => event.preventDefault()} onClick={() => chooseMapboxResult(result)}>
            <span className="block truncate text-sm font-semibold text-slate-800">{result.name}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">{result.address}</span>
          </button>)}
          {searchQuery.trim().length >= 3 && !mapboxSearching && !mapboxSearchError && mapboxResults.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Mapbox chưa tìm thấy địa chỉ hoặc khu vực phù hợp.</p>}
        </>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Kết quả Mapbox chỉ dùng để xem vị trí trên bản đồ; không tự thêm vào danh mục.</p>
      </div>}
    </div>    {!mapReady && !mapError && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-slate-100/70 text-sm text-slate-600">Đang tải bản đồ...</div>}
    {mapError && <div role="alert" className="absolute inset-x-4 top-4 z-10 rounded-xl border border-red-200 bg-white/95 p-4 text-sm text-red-700 shadow">{mapError}</div>}
    {selectingCustomStop && <div role="status" className="absolute bottom-14 left-3 z-10 max-w-[min(90%,28rem)] rounded-lg bg-white/95 px-3 py-2 text-sm text-slate-700 shadow">Bấm vị trí muốn ghim, rồi nhập tên và địa chỉ điểm dừng.<button type="button" className="ml-2 font-semibold text-[#1E3A5F] hover:underline" onClick={() => { pendingCustomStopNameRef.current = null; setSelectingCustomStop(false) }}>Hủy</button></div>}
    {selectedMapboxResult && !selectingCustomStop && <div role="status" className="absolute left-3 right-14 top-[4.5rem] z-20 max-w-lg rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-600 shadow"><p className="truncate font-semibold text-slate-800">{selectedMapboxResult.name}</p><p className="truncate">{selectedMapboxResult.address}</p><button type="button" disabled={resolvingPermanentSearch} className="mt-2 rounded-md bg-[#1E3A5F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#294e7b] disabled:cursor-wait disabled:opacity-60" onClick={() => void addSelectedMapboxResultAsStop()}>{resolvingPermanentSearch ? 'Đang xác nhận địa điểm…' : 'Thêm làm điểm dừng'}</button>{permanentSearchError && <><p className="mt-2 text-amber-800">{permanentSearchError}</p><button type="button" className="mt-1 font-semibold text-[#1E3A5F] hover:underline" onClick={startCustomStopPin}>Ghim thủ công và nhập thông tin</button></>}</div>}
    <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-600 shadow">Địa điểm có sẵn: chọn trên bản đồ · Địa điểm mới: tìm kiếm rồi ghim · © Mapbox</div>
  </div>
}
