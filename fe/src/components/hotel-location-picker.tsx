import { useCallback, useEffect, useRef, useState } from 'react'
import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl'
import { LoaderCircle, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { Button } from './ui/button'
import { hasValidCoordinates, type HotelCoordinates } from '@/lib/coordinates'
import { searchHotelLocations, type HotelLocationResult } from '@/lib/hotel-location-search'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Props {
  latitude?: number | null
  longitude?: number | null
  address: string
  disabled?: boolean
  onChange: (point: HotelCoordinates) => void
}

export function HotelLocationPicker({ latitude, longitude, address, disabled = false, onChange }: Props) {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const onChangeRef = useRef(onChange)
  const initialPoint = useRef({ latitude, longitude })
  const requestRef = useRef(0)
  const searchRef = useRef<AbortController | null>(null)
  const [mapInstance, setMapInstance] = useState<MapboxMap | null>(null)
  const [mapError, setMapError] = useState('')
  const [locationError, setLocationError] = useState('')
  const [locating, setLocating] = useState(false)
  const [searchDraft, setSearchDraft] = useState<string | null>(null)
  const searchQuery = searchDraft ?? address
  const [searchingQuery, setSearchingQuery] = useState<{ query: string; address: string } | null>(null)
  const [suggestions, setSuggestions] = useState<{ query: string; address: string; items: HotelLocationResult[] } | null>(null)
  const searching = searchingQuery?.query === searchQuery && searchingQuery.address === address && !disabled
  const valid = hasValidCoordinates(latitude, longitude)
  const empty = latitude == null && longitude == null

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => () => { requestRef.current += 1; searchRef.current?.abort() }, [])
  useEffect(() => () => { searchRef.current?.abort() }, [address])
  useEffect(() => () => { requestRef.current += 1; searchRef.current?.abort() }, [disabled])

  const choose = useCallback((point: HotelCoordinates) => {
    requestRef.current += 1
    searchRef.current?.abort()
    setSearchingQuery(null)
    setSuggestions(null)
    setLocating(false)
    setLocationError('')
    onChangeRef.current(point)
  }, [])

  useEffect(() => {
    if (!token || !containerRef.current) return
    let map: MapboxMap | undefined
    let observer: ResizeObserver | undefined
    let timer: number | undefined
    // Start after layout so Mapbox sees the container's final dimensions.
    const frame = window.requestAnimationFrame(() => {
      if (!containerRef.current) return
      if (!mapboxgl.supported()) {
        setMapError('Trình duyệt chưa hỗ trợ bản đồ tương tác. Bạn vẫn có thể nhập tọa độ hoặc lấy vị trí hiện tại.')
        return
      }
      const initial = initialPoint.current
      const hasInitial = hasValidCoordinates(initial.latitude, initial.longitude)
      try {
        map = new mapboxgl.Map({
          container: containerRef.current, accessToken: token,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: hasInitial ? [initial.longitude!, initial.latitude!] : [106, 16],
          zoom: hasInitial ? 15 : 4, cooperativeGestures: true,
        })
      } catch {
        setMapError('Chưa mở được bản đồ. Bạn vẫn có thể nhập tọa độ hoặc lấy vị trí hiện tại.')
        return
      }
      mapRef.current = map
      setMapInstance(map)
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
      let loaded = false
      map.once('load', () => { loaded = true; setMapError('') })
      map.on('error', () => { if (!loaded) setMapError('Chưa tải được bản đồ. Hãy kiểm tra kết nối hoặc nhập tọa độ bên dưới.') })
      if (!disabled) map.on('click', event => {
        const point = event.lngLat.wrap()
        choose({ latitude: Number(point.lat.toFixed(7)), longitude: Number(point.lng.toFixed(7)) })
      })
      observer = new ResizeObserver(() => map?.resize())
      observer.observe(containerRef.current)
      timer = window.setTimeout(() => { if (!loaded) setMapError('Bản đồ tải quá lâu. Bạn vẫn có thể nhập tọa độ bên dưới.') }, 12000)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      if (timer !== undefined) window.clearTimeout(timer)
      observer?.disconnect()
      markerRef.current?.remove()
      markerRef.current = null
      map?.remove()
      mapRef.current = null
    }
  }, [choose, disabled, token])

  useEffect(() => {
    const map = mapInstance
    if (!map || mapRef.current !== map) return
    if (!valid) { markerRef.current?.remove(); markerRef.current = null; return }
    if (!markerRef.current) {
      const marker = new mapboxgl.Marker({ color: '#176b70', draggable: !disabled }).setLngLat([longitude!, latitude!]).addTo(map)
      marker.on('dragend', () => {
        const point = marker.getLngLat().wrap()
        choose({ latitude: Number(point.lat.toFixed(7)), longitude: Number(point.lng.toFixed(7)) })
      })
      markerRef.current = marker
    }
    markerRef.current.setLngLat([longitude!, latitude!])
    map.easeTo({ center: [longitude!, latitude!], zoom: Math.max(map.getZoom(), 15), duration: 350 })
  }, [mapInstance, latitude, longitude, valid, disabled, choose])

  const locate = () => {
    searchRef.current?.abort()
    setSearchingQuery(null)
    setSuggestions(null)
    setLocationError('')
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationError('Cần mở website bằng HTTPS và dùng trình duyệt hỗ trợ định vị. Bạn có thể chọn trên bản đồ hoặc nhập tọa độ.')
      return
    }
    const request = ++requestRef.current
    setLocating(true)
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== requestRef.current) return
      choose({ latitude: position.coords.latitude, longitude: position.coords.longitude })
    }, error => {
      if (request !== requestRef.current) return
      setLocating(false)
      setLocationError(error.code === 1 ? 'Bạn chưa cho phép truy cập vị trí. Hãy cấp quyền hoặc chọn vị trí thủ công.' : 'Chưa lấy được vị trí hiện tại. Hãy thử lại hoặc chọn vị trí thủ công.')
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  }

  const searchAddress = async () => {
    if (disabled) return
    const query = searchQuery.trim().replace(/\s+/g, ' ')
    if (query.length < 3 || query.length > 200) {
      setLocationError('Nhập địa chỉ từ 3 đến 200 ký tự để tìm vị trí.')
      return
    }
    searchRef.current?.abort()
    const controller = new AbortController()
    searchRef.current = controller
    const request = ++requestRef.current
    setLocating(false)
    setSearchingQuery({ query: searchQuery, address })
    setLocationError('')
    setSuggestions(null)
    try {
      const results = await searchHotelLocations(query, controller.signal)
      if (controller.signal.aborted || request !== requestRef.current) return
      if (!results.length) { setLocationError('Không tìm thấy địa chỉ phù hợp. Hãy thêm tên đường, phường hoặc thành phố rồi tìm lại.'); return }
      setSuggestions({ query: searchQuery, address, items: results })
    } catch (error) {
      if (!controller.signal.aborted && request === requestRef.current) {
        const status = (error as { status?: number })?.status
        setLocationError(status === 429 ? 'Dịch vụ tìm địa chỉ đang bận. Vui lòng chờ một lát rồi tìm lại.' : 'Chưa tìm được địa chỉ trên bản đồ. Hãy thử lại hoặc chọn vị trí thủ công.')
      }
    } finally {
      if (request === requestRef.current) setSearchingQuery(null)
    }
  }

  return <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-4" aria-labelledby="hotel-location-title">
    <h3 id="hotel-location-title" className="flex items-center gap-2 font-semibold text-slate-800"><MapPin size={18} className="text-[#176b70]" />Vị trí khách sạn</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">Chọn đúng vị trí lối vào khách sạn bằng cách bấm trên bản đồ, kéo ghim hoặc nhập tọa độ. Vị trí này dùng để hiển thị bản đồ và tìm khách sạn gần khách.</p>
    <div className="my-3 flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" disabled={disabled || locating} onClick={locate}>{locating ? <LoaderCircle size={16} className="animate-spin" /> : <LocateFixed size={16} />}Dùng vị trí hiện tại</Button>
      {!empty && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => choose({ latitude: null, longitude: null })}><X size={16} />Xóa vị trí</Button>}
    </div>
    <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">Địa chỉ cần tìm trên bản đồ
        <input type="search" maxLength={200} disabled={disabled} value={searchQuery} placeholder="Nhập số nhà, tên đường, phường hoặc thành phố" onChange={event => {
          requestRef.current += 1; searchRef.current?.abort(); setLocating(false); setSearchingQuery(null); setSuggestions(null); setLocationError(''); setSearchDraft(event.target.value)
        }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!searching) void searchAddress() } }} />
      </label>
      <Button type="button" variant="secondary" disabled={disabled || searching} onClick={() => void searchAddress()}>{searching ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}Tìm địa chỉ trên bản đồ</Button>
    </div>
    {searching && <p role="status" className="mb-3 text-sm text-slate-600">Đang tìm địa chỉ...</p>}
    {token ? <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-80" aria-label="Bản đồ chọn vị trí khách sạn" />
      : <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">Bản đồ chưa được cấu hình. Bạn vẫn có thể nhập tọa độ hoặc dùng vị trí hiện tại.</p>}
    {mapError && <p role="status" className="mt-2 text-sm text-amber-800">{mapError}</p>}
    {suggestions && suggestions.address === address && suggestions.query === searchQuery && <div className="mt-3 rounded-lg border border-sky-200 bg-white p-3 text-sm">
      <p className="font-medium">Chọn địa chỉ phù hợp với khách sạn</p>
      <ul className="mt-2 divide-y divide-slate-100">{suggestions.items.map(result => <li key={result.id} className="flex flex-col items-start gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 break-words">{result.address}</p>
        <Button type="button" variant="secondary" size="sm" disabled={disabled} className="shrink-0" aria-label={`Chọn vị trí: ${result.address}`} onClick={() => choose({ latitude: result.latitude, longitude: result.longitude })}>Chọn vị trí này</Button>
      </li>)}</ul>
    </div>}
    <p className="mt-2 text-xs text-slate-500">Dữ liệu địa chỉ © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a></p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">Vĩ độ<input aria-label="Vĩ độ khách sạn" type="number" min={-90} max={90} step="any" placeholder="Ví dụ: 16.0614" disabled={disabled} value={latitude ?? ''} onChange={event => choose({ latitude: event.target.value === '' ? null : Number(event.target.value), longitude: longitude ?? null })} /></label>
      <label className="text-sm font-medium text-slate-700">Kinh độ<input aria-label="Kinh độ khách sạn" type="number" min={-180} max={180} step="any" placeholder="Ví dụ: 108.2468" disabled={disabled} value={longitude ?? ''} onChange={event => choose({ latitude: latitude ?? null, longitude: event.target.value === '' ? null : Number(event.target.value) })} /></label>
    </div>
    {!empty && !valid && <p role="alert" className="mt-2 text-sm text-red-700">Nhập đủ vĩ độ từ −90 đến 90 và kinh độ từ −180 đến 180, hoặc xóa cả hai.</p>}
    {locationError && <p role="alert" className="mt-2 text-sm text-red-700">{locationError}</p>}
    <p className="mt-3 text-xs leading-5 text-slate-500">{empty ? 'Chưa đặt vị trí. Khách sạn vẫn tìm được theo tên/thành phố, nhưng sẽ không xuất hiện trong “Gần tôi”.' : 'Lưu hồ sơ khách sạn để lưu thay đổi vị trí.'} Khi đổi địa chỉ, hãy kiểm tra lại ghim trên bản đồ.</p>
  </section>
}
