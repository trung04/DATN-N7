import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Heart, MapPin, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, DetailLink, EmptyState, ErrorState, Feedback, LoadingState, PageHeader, Picture } from '@/components/common'
import { repo, isMock } from '@/services'
import { api } from '@/services/api/client'
import { currency, day, errorMessage, nights, todayPlus } from '@/lib/utils'
import { useSession } from '@/stores/session'
import { useCatalog } from '@/hooks/data'
import { travelImage } from '@/lib/travel-images'
import { seededHotelPhoto } from '@/lib/hotel-media'
import type { Destination, Hotel, Stopover } from '@/types/domain'
import { RoomTypePicker } from './RoomTypePicker'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useFavorites, useMyItineraries } from '@/hooks/data'

const cardTitle = 'text-lg font-semibold text-slate-900'

function HotelImage({ hotel, className }: { hotel: Hotel; className?: string }) {
  const seededPhoto = seededHotelPhoto(hotel)
  const fallback = hotel.image || seededPhoto ? undefined : travelImage(hotel.city, 'hotel')
  const image = hotel.image ?? seededPhoto ?? fallback
  if (image) return <div className="group relative overflow-hidden">
    <Picture label={hotel.image || seededPhoto ? hotelDisplayName(hotel) : 'khu vực ' + hotel.city} src={image} className={className} />
    {fallback && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">Ảnh minh họa khu vực</span>}
  </div>
  return hotel.image
    ? <Picture label={hotel.name} src={hotel.image} className={className} />
    : <div role="img" aria-label={'Chưa có ảnh khách sạn ' + hotel.name} className={'relative flex aspect-[4/3] flex-col items-center justify-center gap-3 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 ' + (className ?? '')}>
      <Building2 size={38} strokeWidth={1.3} />
      <span className="text-sm">Chưa có ảnh khách sạn</span>
    </div>
}

function isSampleHotel(_hotel: Hotel) { return false }
function hotelDisplayName(hotel: Hotel) { return hotel.name.replace(/^DEMO\s*[-–:]\s*/i, '') }
function hotelLocation(hotel: Hotel) { return hotel.area && hotel.area !== hotel.city ? hotel.area + ', ' + hotel.city : hotel.city }

function FavoriteButton({ id, targetType }: { id: string; targetType: 'PLACE' | 'HOTEL' }) {
  const user = useSession(s => s.user)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const { data: favorites } = useFavorites()
  const saved = favorites?.some(favorite => favorite.targetId === id && favorite.targetType === targetType) ?? false
  return <div className="flex items-center gap-2"><Button type="button" variant="secondary" size="sm" aria-label={saved ? 'Bỏ yêu thích' : 'Lưu yêu thích'} onClick={async () => {
    if (!user || user.role !== 'tourist') { navigate('/auth/login?returnTo=' + encodeURIComponent(location.pathname + location.search)); return }
    try {
      if (isMock) await repo.toggleFavorite(user.id, id)
      else await api.toggleMyFavorite(targetType, id)
      await queryClient.invalidateQueries({ queryKey: ['favorites', user.id] })
      setMessage(saved ? 'Đã bỏ yêu thích' : 'Đã lưu yêu thích')
    } catch (error) { setMessage(errorMessage(error)) }
  }}><Heart size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Đã lưu' : 'Yêu thích'}</Button>{message && <span role="status" className="text-xs text-slate-500">{message}</span>}</div>
}

function AddDestinationToTrip({ place }: { place: Destination }) {
  const user = useSession(s => s.user)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useMyItineraries()
  const [open, setOpen] = useState(false)
  const [busyTripId, setBusyTripId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const trips = (data?.trips ?? []).filter(trip => trip.city === place.city)

  const addToTrip = async (tripId: string) => {
    if (!user || !data) return
    const trip = data.trips.find(item => item.id === tripId)
    if (!trip) return
    setBusyTripId(trip.id)
    setMessage('')
    try {
      const stops = data.stops.filter(stop => stop.tripId === trip.id)
      if (stops.some(stop => stop.placeId === place.id)) {
        throw new Error('Địa điểm này đã có trong chuyến đi.')
      }
      const slot = findNextStopTime(trip.startDate, trip.endDate, stops)
      const order = Math.max(0, ...stops.map(stop => stop.order)) + 1
      await repo.saveStop(user.id, {
        id: '', tripId: trip.id, placeId: place.id, name: place.name,
        address: place.region || place.city, start: slot.start, end: slot.end,
        order, note: '',
      })
      await queryClient.invalidateQueries({ queryKey: ['my-itineraries', user.id] })
      setOpen(false)
      navigate('/trips/' + trip.id)
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setBusyTripId(null)
    }
  }

  const openDialog = () => {
    if (!user || user.role !== 'tourist') {
      navigate('/auth/login?returnTo=' + encodeURIComponent(location.pathname + location.search))
      return
    }
    setMessage('')
    setOpen(true)
  }

  const createTripUrl = '/trips/new?placeId=' + encodeURIComponent(place.id)
    + '&city=' + encodeURIComponent(place.city)
    + '&placeName=' + encodeURIComponent(place.name)

  return <>
    <Button type="button" onClick={openDialog}>Thêm vào chuyến đi</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Thêm địa điểm vào chuyến đi" description={place.name + ' · ' + place.city}>
        {isLoading ? <LoadingState label="Đang tải chuyến đi..." /> : error ? <ErrorState message={errorMessage(error)} /> : trips.length ? <div className="grid gap-2">
          {trips.map(trip => <Button key={trip.id} type="button" variant="secondary" className="justify-between" disabled={Boolean(busyTripId)} onClick={() => void addToTrip(trip.id)}>
            <span className="truncate">{trip.name}</span><span className="ml-3 shrink-0 text-xs">{day(trip.startDate)} – {day(trip.endDate)}</span>
          </Button>)}
        </div> : <EmptyState title="Chưa có chuyến đi ở khu vực này" description="Tạo chuyến đi mới để lưu địa điểm này vào lịch trình." />}
        {message && <p role="alert" className="mt-3 text-sm text-red-700">{message}</p>}
        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <Button asChild variant="secondary"><Link to={createTripUrl}>Tạo chuyến đi mới</Link></Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Đóng</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>
}

function findNextStopTime(startDate: string, endDate: string, stops: Stopover[]) {
  const booked = stops.map(stop => ({ start: stop.start, end: stop.end }))
  const lastStop = [...stops].sort((a, b) => a.start.localeCompare(b.start)).at(-1)
  const earliestStart = lastStop?.end ?? startDate + 'T09:00'
  for (let date = startDate; date <= endDate; date = nextDate(date)) {
    for (let hour = 9; hour <= 21; hour += 1) {
      const start = date + 'T' + String(hour).padStart(2, '0') + ':00'
      const endHour = hour + 2
      if (endHour > 23) continue
      const end = date + 'T' + String(endHour).padStart(2, '0') + ':00'
      if (start < earliestStart) continue
      if (booked.every(stop => stop.end <= start || stop.start >= end)) return { start, end }
    }
  }
  throw new Error('Chuyến đi đã kín lịch. Hãy kéo dài thời gian chuyến đi hoặc sắp xếp lại điểm dừng.')
}

function nextDate(date: string) {
  const next = new Date(date + 'T00:00:00Z')
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

export function DestinationCard({ item }: { item: Destination }) { return <Card className="group overflow-hidden transition-shadow hover:shadow-md"><Picture label={item.name} src={item.image ?? travelImage(item.city)} /><div className="p-5"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1E3A5F]">{item.category}</div><h3 className={cardTitle}>{item.name}</h3><p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} />{item.region}, {item.city}</p><p className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-600">{item.description}</p><div className="mt-4 flex items-center justify-between"><DetailLink to={'/explore/' + item.id} /><span className="text-sm font-medium">{item.price ? currency(item.price) : 'Miễn phí'}</span></div></div></Card> }
export function HotelCard({ item, price, search = '' }: { item: Hotel; price: number; search?: string }) { return <Card className="group overflow-hidden transition-shadow hover:shadow-md"><HotelImage hotel={item} /><div className="p-5"><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-[#1E3A5F]">{item.stars} sao</span>{isSampleHotel(item) && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Dữ liệu mẫu</span>}</div>{item.rating && <span className="flex items-center gap-1 text-sm text-amber-700"><Star size={14} fill="currentColor" />{item.rating}</span>}</div><h3 className={cardTitle}>{hotelDisplayName(item)}</h3><p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} />{hotelLocation(item)}</p><p className="mt-3 text-sm text-slate-600">{item.amenities.slice(0, 3).join(' · ')}</p><div className="mt-4 flex items-end justify-between gap-2"><DetailLink to={'/hotels/' + item.id + search} /><div className="text-right"><span className="text-xs text-slate-500">Từ / đêm</span><p className="font-semibold text-[#1E3A5F]">{currency(price)}</p></div></div></div></Card> }

export function ExplorePage() {
  const { data, isLoading, error } = useCatalog()
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').toLowerCase()
  const city = params.get('city') ?? ''
  const category = params.get('category') ?? ''
  const sort = params.get('sort') ?? 'name'
  const [keyword, setKeyword] = useState(params.get('q') ?? '')
  const items = useMemo(() => {
    const filtered = (data?.destinations ?? []).filter(x => (!q || (x.name + ' ' + x.city + ' ' + x.tags.join(' ')).toLowerCase().includes(q)) && (!city || x.city === city) && (!category || x.category === category))
    return filtered.sort((a, b) => sort === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) : a.name.localeCompare(b.name, 'vi'))
  }, [data, q, city, category, sort])
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next) }
  return <div className="container-app section-pad"><PageHeader title="Khám phá điểm đến" description="Tìm địa điểm theo khu vực và loại trải nghiệm." /><div className="mb-7 grid gap-3 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 md:grid-cols-[2fr_1fr_1fr_1fr]"><form onSubmit={e => { e.preventDefault(); update('q', keyword) }}><label className="text-sm font-medium">Từ khóa<input placeholder="Tên hoặc sở thích" value={keyword} onChange={e => setKeyword(e.target.value)} /></label></form><label className="text-sm font-medium">Thành phố<select value={city} onChange={e => update('city', e.target.value)}><option value="">Tất cả</option>{[...new Set(data?.destinations.map(x => x.city) ?? [])].map(x => <option key={x}>{x}</option>)}</select></label><label className="text-sm font-medium">Loại hình<select value={category} onChange={e => update('category', e.target.value)}><option value="">Tất cả</option>{[...new Set(data?.destinations.map(x => x.category) ?? [])].map(x => <option key={x}>{x}</option>)}</select></label><label className="text-sm font-medium">Sắp xếp<select value={sort} onChange={e => update('sort', e.target.value)}><option value="name">Tên A–Z</option><option value="rating">Đánh giá cao</option></select></label></div>{isLoading ? <LoadingState /> : error ? <ErrorState message={errorMessage(error)} /> : items.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => <DestinationCard key={item.id} item={item} />)}</div> : <EmptyState title="Không tìm thấy điểm đến" description="Thử đổi từ khóa hoặc bỏ bớt bộ lọc." action={<Button variant="secondary" onClick={() => setParams({})}>Xóa bộ lọc</Button>} />}</div>
}
export function DestinationDetailPage() {
  const { id } = useParams()
  const { data, isLoading, error } = useCatalog()
  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  const item = data?.destinations.find(x => x.id === id)
  if (!item) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy địa điểm" action={<Button asChild><Link to="/explore">Về Khám phá</Link></Button>} /></div>
  return <div className="container-app section-pad"><Link className="text-sm text-[#1E3A5F] hover:underline" to="/explore">← Khám phá</Link><div className="mt-5 grid gap-8 lg:grid-cols-[1.2fr_.8fr]"><Picture label={item.name} src={item.image ?? travelImage(item.city)} className="rounded-xl" /><div><span className="text-sm font-semibold text-[#1E3A5F]">{item.category}</span><h1 className="mt-2 text-3xl font-semibold">{item.name}</h1><p className="mt-2 text-slate-500">{item.region}, {item.city}</p><p className="mt-6 leading-7 text-slate-700">{item.description}</p><dl className="mt-6 grid gap-3 text-sm"><div><dt className="font-semibold">Giờ hoạt động</dt><dd className="text-slate-600">{item.openingHours ?? 'Chưa có thông tin'}</dd></div><div><dt className="font-semibold">Giá tham khảo</dt><dd className="text-slate-600">{item.price ? currency(item.price) : 'Miễn phí'}</dd></div>{item.lat && <div><dt className="font-semibold">Tọa độ</dt><dd className="text-slate-600">{item.lat}, {item.lng}</dd></div>}</dl><div className="mt-7 flex flex-wrap items-center gap-3"><AddDestinationToTrip place={item} /><FavoriteButton id={item.id} targetType="PLACE" /></div></div></div></div>
}

export function HotelsPage() {
  const { data, isLoading, error } = useCatalog()
  const [params, setParams] = useSearchParams()
  const [keyword, setKeyword] = useState(params.get('city') ?? '')
  const city = params.get('city') ?? ''
  const checkIn = params.get('checkIn') ?? todayPlus(7)
  const checkOut = params.get('checkOut') ?? todayPlus(9)
  const adults = Number(params.get('adults') ?? 2)
  const children = Number(params.get('children') ?? 0)
  const rooms = Number(params.get('rooms') ?? 1)
  const stars = Number(params.get('stars') ?? 0)
  const maxPrice = Number(params.get('maxPrice') ?? 0)
  const sort = params.get('sort') ?? 'recommended'
  const validDates = checkIn >= todayPlus(0) && nights(checkIn, checkOut) > 0
  const availabilityQuery = useQuery({
    queryKey: ['room-availability', 'all-hotels', checkIn, checkOut],
    queryFn: () => api.searchRoomAvailability({ checkInDate: checkIn, checkOutDate: checkOut }),
    enabled: !isMock && Boolean(data) && validDates,
  })
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next) }
  const items = useMemo(() => {
    if (!data) return []
    return data.hotels.map(hotel => {
      const hotelRooms = data.rooms.filter(r => r.hotelId === hotel.id && r.capacity * rooms >= adults + children && (isMock || r.operationalStatus === 'AVAILABLE'))
      const availableRooms = hotelRooms.filter(room => isMock ? !validDates || Array.from({ length: nights(checkIn, checkOut) }, (_, i) => {
        const date = new Date(checkIn + 'T12:00:00'); date.setDate(date.getDate() + i); return date.toISOString().slice(0, 10)
      }).every(date => (data.availability.find(a => a.roomId === room.id && a.date === date)?.available ?? Number.POSITIVE_INFINITY) >= rooms) : availabilityQuery.data?.availableRoomIds.includes(room.id) ?? false)
      return { hotel, price: Math.min(...availableRooms.map(r => r.basePrice)), available: availableRooms.length >= rooms }
    }).filter(x => x.hotel.city.toLowerCase().includes(city.toLowerCase()) && x.hotel.stars >= stars && x.available && (!maxPrice || x.price <= maxPrice))
      .sort((a, b) => sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : sort === 'rating' ? (b.hotel.rating ?? 0) - (a.hotel.rating ?? 0) : b.hotel.stars - a.hotel.stars)
  }, [data, city, checkIn, checkOut, adults, children, rooms, stars, maxPrice, sort, validDates, availabilityQuery.data])
  return <div className="container-app section-pad"><section className="relative mb-7 overflow-hidden rounded-[26px] bg-[#1E3A5F] text-white">{travelImage(city || "Đà Nẵng") && <img src={travelImage(city || "Đà Nẵng")} alt="Ảnh minh họa điểm đến" className="absolute inset-0 h-full w-full object-cover opacity-45" />}<div className="absolute inset-0 bg-gradient-to-r from-[#102947]/95 via-[#173858]/75 to-transparent" /><div className="relative max-w-2xl px-6 py-10 sm:px-10 sm:py-14"><p className="text-xs font-semibold uppercase tracking-[.16em] text-white/80">Nơi ở cho chuyến đi</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Tìm khách sạn phù hợp với bạn</h1><p className="mt-3 text-sm leading-6 text-white/90 sm:text-base">Chọn ngày lưu trú, số khách và mức giá. Xem phòng còn nhận đặt theo từng đêm.</p></div></section><div className="mb-5 flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-500">Tìm nhanh:</span>{["Đà Nẵng", "Đà Lạt", "Huế"].map(x => <button key={x} type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-[#1E3A5F] hover:border-[#1E3A5F]" onClick={() => { setKeyword(x); update("city", x) }}>{x}</button>)}</div><div className="mb-7 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-28px_rgba(30,58,95,.35)] md:grid-cols-3 lg:grid-cols-4"><form className="lg:col-span-2" onSubmit={e => { e.preventDefault(); update('city', keyword) }}><label className="text-sm font-medium">Điểm đến<input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Đà Nẵng, Đà Lạt..." /></label></form><label className="text-sm font-medium">Nhận phòng<input type="date" min={todayPlus(0)} value={checkIn} onChange={e => update('checkIn', e.target.value)} /></label><label className="text-sm font-medium">Trả phòng<input type="date" min={checkIn} value={checkOut} onChange={e => update('checkOut', e.target.value)} /></label><label className="text-sm font-medium">Người lớn<input type="number" min="1" max="12" value={adults} onChange={e => update('adults', e.target.value)} /></label><label className="text-sm font-medium">Số phòng<input type="number" min="1" max="5" value={rooms} onChange={e => update('rooms', e.target.value)} /></label><label className="text-sm font-medium">Trẻ em<input type="number" min="0" max="10" value={children} onChange={e => update('children', e.target.value)} /></label><label className="text-sm font-medium">Hạng sao<select value={stars} onChange={e => update('stars', e.target.value)}><option value="0">Tất cả</option><option value="3">Từ 3 sao</option><option value="4">Từ 4 sao</option></select></label><label className="text-sm font-medium">Giá tối đa / đêm<select value={maxPrice} onChange={e => update('maxPrice', e.target.value)}><option value="0">Không giới hạn</option><option value="1000000">1.000.000 ₫</option><option value="1500000">1.500.000 ₫</option><option value="2500000">2.500.000 ₫</option></select></label><label className="text-sm font-medium">Sắp xếp<select value={sort} onChange={e => update('sort', e.target.value)}><option value="recommended">Đề xuất</option><option value="price-asc">Giá thấp trước</option><option value="price-desc">Giá cao trước</option><option value="rating">Đánh giá cao</option></select></label><div className="flex items-end"><Button className="w-full" onClick={() => update('city', keyword)}><Search size={17} />Tìm phòng</Button></div></div>
    {!validDates ? <Feedback kind="error" message="Ngày trả phòng phải sau ngày nhận phòng và ngày nhận phòng không được ở quá khứ." /> : isLoading || (!isMock && availabilityQuery.isPending) ? <LoadingState /> : error ? <ErrorState message={errorMessage(error)} /> : !isMock && availabilityQuery.isError ? <ErrorState message={errorMessage(availabilityQuery.error)} retry={() => { void availabilityQuery.refetch() }} /> : items.length ? <><p className="mb-4 text-sm text-slate-500">{items.length} khách sạn phù hợp</p><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(({ hotel, price }) => <HotelCard key={hotel.id} item={hotel} price={price} search={params.toString() ? '?' + params.toString() : ''} />)}</div></> : <EmptyState title="Không có khách sạn phù hợp" description="Thử đổi ngày lưu trú hoặc nới bộ lọc." action={<Button variant="secondary" onClick={() => setParams({})}>Đặt lại bộ lọc</Button>} />}</div>
}

export function HotelDetailPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data, isLoading, error } = useCatalog()
  const publicReviews = useQuery({ queryKey: ['public-reviews', id], queryFn: () => api.publicReviewPage({ hotelId: id!, page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'DESC' }), enabled: Boolean(id) && !isMock })
  const reviewSummary = useQuery({ queryKey: ['public-review-summary', id], queryFn: () => api.publicReviewSummary(id!), enabled: Boolean(id) && !isMock })
  const checkIn = params.get('checkIn') ?? todayPlus(7)
  const checkOut = params.get('checkOut') ?? todayPlus(9)
  const adults = Number(params.get('adults') ?? 2)
  const children = Number(params.get('children') ?? 0)
  const back = '/hotels' + (params.toString() ? '?' + params.toString() : '')
  const availabilityQuery = useQuery({
    queryKey: ['room-availability', id, checkIn, checkOut],
    queryFn: () => api.searchRoomAvailability({ hotelId: id!, checkInDate: checkIn, checkOutDate: checkOut }),
    enabled: Boolean(id) && !isMock && checkIn >= todayPlus(0) && nights(checkIn, checkOut) > 0,
  })
  const cancellationScheduleQuery = useQuery({
    queryKey: ['cancellation-policy-schedule', id],
    queryFn: () => api.cancellationPolicySchedule(id!),
    enabled: Boolean(id) && !isMock,
  })
  if (isLoading) return <LoadingState />
  if (!isMock && checkIn >= todayPlus(0) && nights(checkIn, checkOut) > 0 && availabilityQuery.isPending) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  if (!isMock && availabilityQuery.isError) return <div className="container-app section-pad"><ErrorState message={errorMessage(availabilityQuery.error)} retry={() => { void availabilityQuery.refetch() }} /></div>
  const hotel = data?.hotels.find(x => x.id === id)
  if (!hotel || !data) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy khách sạn" action={<Button asChild><Link to="/hotels">Về danh sách</Link></Button>} /></div>
  const reviews = isMock ? data.reviews.filter(r => r.hotelId === id && r.status === 'VISIBLE') : (publicReviews.data?.data ?? [])
  return <div className="container-app section-pad"><Link className="text-sm text-[#1E3A5F] hover:underline" to={back}>← Quay lại kết quả tìm kiếm</Link><div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_.9fr]"><HotelImage hotel={hotel} className="rounded-xl" /><div><div className="text-sm font-semibold text-[#1E3A5F]">{hotel.stars} sao · {reviewSummary.data ? reviewSummary.data.averageRating.toFixed(1) + ' (' + reviewSummary.data.visibleCount + ' đánh giá)' : hotel.rating ? 'Đánh giá ' + hotel.rating : 'Chưa có đánh giá'}{isSampleHotel(hotel) && <span className="ml-2 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">Dữ liệu mẫu</span>}</div><h1 className="mt-2 text-3xl font-semibold">{hotelDisplayName(hotel)}</h1><p className="mt-2 flex items-center gap-1 text-slate-500"><MapPin size={16} />{hotel.address}</p><p className="mt-5 leading-7 text-slate-700">{hotel.description}</p><div className="mt-5 flex flex-wrap gap-2">{hotel.amenities.map(x => <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700" key={x}>{x}</span>)}</div>{isMock ? <p className="mt-5 text-sm text-slate-600"><strong>Chính sách hủy:</strong> {hotel.cancellationPolicy}</p> : cancellationScheduleQuery.data?.complete ? <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"><h2 className="font-semibold">Chính sách hủy</h2><ul className="mt-2 grid gap-2 text-sm text-slate-600">{cancellationScheduleQuery.data.rules.map(rule => <li key={rule.id}>{rule.cancellationAllowed ? `Miễn phí hủy trong ${rule.cancelHours} giờ đầu sau khi đặt; sau đó phí hủy ${rule.penaltyPercent}%.` : `Không hỗ trợ hủy. ${rule.description ?? ''}`}</li>)}</ul></section> : <Feedback kind="error" message={cancellationScheduleQuery.data?.issue ?? "Chính sách hủy chưa được cấu hình đầy đủ."} />}<div className="mt-5"><FavoriteButton id={hotel.id} targetType="HOTEL" /></div></div></div><div className="mt-12"><PageHeader title="Chọn loại phòng" description={'Lưu trú ' + checkIn + ' đến ' + checkOut + ' · ' + adults + ' người lớn, ' + children + ' trẻ em'} /><RoomTypePicker hotel={hotel} rooms={data.rooms.filter(room => room.hotelId === hotel.id)} data={data} availableRoomIds={availabilityQuery.data?.availableRoomIds} checkIn={checkIn} checkOut={checkOut} adults={adults} children={children} isMock={isMock} /></div><div className="mt-12"><h2 className="mb-4 text-2xl font-semibold">Đánh giá khách hàng</h2>{reviews.length ? <div className="grid gap-3">{reviews.map(r => <Card key={r.id} className="p-5"><p className="font-semibold">{r.stars}/5 sao</p><p className="mt-2 text-sm text-slate-600">{r.content}</p></Card>)}</div> : <p className="text-sm text-slate-500">Chưa có đánh giá được công bố.</p>}</div></div>
}
