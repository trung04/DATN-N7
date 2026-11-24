import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HotelDestinationSearch } from '@/components/hotel-destination-search'
import { HotelSearchForm } from '@/components/hotel-search-form'
import { DetailLink, ErrorState, LoadingState } from '@/components/common'
import { DestinationCard, HotelCard } from './catalog'
import { useCatalog } from '@/hooks/data'
import { errorMessage, nights, todayPlus } from '@/lib/utils'
import { heroImage, travelImage } from '@/lib/travel-images'
import { hotelSearchParams, type HotelSearchSelection } from '@/lib/hotel-search'

const popularCities = ['Đà Nẵng', 'Đà Lạt', 'Huế', 'Quảng Nam']

export function HomePage() {
  const { data, isLoading, error, refetch } = useCatalog()
  const navigate = useNavigate()
  const [city, setCity] = useState('')
  const [destination, setDestination] = useState<HotelSearchSelection | null>(null)
  const [filters, setFilters] = useState(() => new URLSearchParams({ checkIn: todayPlus(7), checkOut: todayPlus(9), adults: '2', rooms: '1' }))
  const updateFilters = (values: Record<string, string>) => setFilters(previous => {
    const next = new URLSearchParams(previous)
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    return next
  })
  const [searchError, setSearchError] = useState('')

  const searchHotels = (event: FormEvent) => {
    event.preventDefault()
    const checkIn = filters.get('checkIn') ?? todayPlus(7)
    const checkOut = filters.get('checkOut') ?? todayPlus(9)
    const adults = Number(filters.get('adults') ?? 2)
    if (checkIn < todayPlus(0) || nights(checkIn, checkOut) < 1 || adults < 1) {
      setSearchError('Kiểm tra ngày nhận, trả phòng và số khách.')
      return
    }
    setSearchError('')
    const params = new URLSearchParams(filters)
    Object.entries(hotelSearchParams(destination, city)).forEach(([key, value]) => { if (value) params.set(key, value) })
    navigate('/hotels?' + params)
  }

  return <div className="home-page bg-white">
    <section className="home-hero-container container-travel pt-6 md:pt-8">
      <div className="home-hero relative overflow-hidden rounded-[28px] bg-[#1E3A5F] text-white">
        <img src={heroImage} alt="Bờ biển Đà Nẵng" className="absolute inset-0 h-full w-full object-cover object-center opacity-65" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102947]/95 via-[#173858]/80 to-[#173858]/10" />
        <div className="home-hero-content relative max-w-[820px] px-6 py-14 sm:px-10 md:py-20 lg:px-16 lg:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur"><Sparkles size={15} />Khám phá Việt Nam theo cách của bạn</span>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">Khám phá hành trình phù hợp với bạn</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/90 sm:text-lg">Tìm nơi ở, chọn trải nghiệm yêu thích và sắp xếp từng ngày thành một chuyến đi thật dễ hình dung.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg" className="bg-white text-[#1E3A5F] hover:bg-slate-100"><Link to="/ai/trip-planner"><Sparkles size={18} />Lập lịch trình với AI</Link></Button><Button asChild size="lg" variant="secondary" className="border-white/40 bg-white/10 text-white hover:bg-white/20"><Link to="/explore">Khám phá điểm đến<ArrowRight size={17} /></Link></Button></div>
        </div>
      </div>
      <HotelSearchForm className="home-search -mt-5" values={filters} onChange={updateFilters} onSubmit={searchHotels} error={searchError}
        availableAmenities={[...new Set(data?.hotels.flatMap(hotel => hotel.amenities) ?? [])].sort((a, b) => a.localeCompare(b, 'vi'))}
        destination={<HotelDestinationSearch value={city} onChange={value => { setCity(value); setDestination(null) }} onSelect={selection => { setCity(selection.label); setDestination(selection) }} hotels={data?.hotels ?? []} destinations={data?.destinations ?? []} isLoading={isLoading} hasError={Boolean(error)} onRetry={() => void refetch()} />} />
      <div className="home-popular container-travel mt-5 flex flex-wrap items-center gap-2 text-sm"><span className="mr-1 text-slate-500">Điểm đến được yêu thích:</span>{popularCities.map(x => <Link key={x} to={'/explore?city=' + encodeURIComponent(x)} className="rounded-full border border-slate-200 px-3 py-1.5 text-[#1E3A5F] hover:border-[#1E3A5F] hover:bg-[#EAF0F6]">{x}</Link>)}</div>
    </section>

    {isLoading ? <LoadingState /> : error ? <div className="container-travel section-pad"><ErrorState message={errorMessage(error)} /></div> : data && <>
      <section className="container-travel section-pad">
        <SectionHeading eyebrow="Truyền cảm hứng" title="Bắt đầu từ một nơi bạn muốn đến" description="Từ biển xanh đến phố cổ, chọn điểm đến rồi tạo hành trình của riêng bạn." to="/explore" link="Xem tất cả" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{popularCities.map(cityName => {
          const count = data.destinations.filter(place => place.city === cityName).length
          return <Link key={cityName} to={'/explore?city=' + encodeURIComponent(cityName)} className="group relative flex min-h-64 items-end overflow-hidden rounded-2xl bg-slate-200 p-5 text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"><img src={travelImage(cityName)} alt={'Ảnh ' + cityName} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /><span className="absolute inset-0 bg-gradient-to-t from-[#102947]/85 via-transparent to-transparent" /><span className="relative"><strong className="block text-xl">{cityName}</strong><span className="text-sm text-white/85">{count} địa điểm trong danh mục</span></span><ArrowRight className="relative ml-auto" size={18} /></Link>
        })}</div>
      </section>
      <section className="bg-[#F7F9FC]"><div className="container-travel section-pad">
        <SectionHeading eyebrow="Lên đường dễ hơn" title="Lịch trình theo sở thích của bạn" description="Chọn ngày, ngân sách và điều bạn thích. Công cụ dùng địa điểm trong danh mục để sắp xếp lịch theo giờ mở cửa." to="/ai/trip-planner" link="Bắt đầu lập lịch trình" />
        <div className="grid gap-4 md:grid-cols-3">{[
          ['01', 'Chọn chuyến đi', 'Điểm đến, ngày đi, số khách và ngân sách.'],
          ['02', 'Xem gợi ý từng ngày', 'Biết vì sao địa điểm được chọn và chi phí dự kiến.'],
          ['03', 'Tinh chỉnh rồi lưu', 'Đổi nhịp độ, sửa hoạt động và lưu vào chuyến đi.'],
        ].map(([number, title, text]) => <div key={number} className="rounded-2xl border border-slate-200 bg-white p-6"><span className="text-sm font-bold text-[#5D8BA5]">{number}</span><h3 className="mt-4 text-lg font-semibold text-[#1E3A5F]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}</div>
      </div></section>
      <section className="container-travel section-pad"><SectionHeading eyebrow="Nơi ở" title="Khách sạn cho hành trình sắp tới" description="So sánh tiện nghi và mức giá trước khi chọn phòng." to="/hotels" link="Tìm khách sạn" /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{data.hotels.slice(0, 4).map(item => <HotelCard key={item.id} item={item} price={Math.min(...data.rooms.filter(room => room.hotelId === item.id).map(room => room.basePrice))} />)}</div></section>
      <section className="bg-[#F7F9FC]"><div className="container-travel section-pad"><SectionHeading eyebrow="Trải nghiệm" title="Khám phá điểm đến nổi bật" description="Tìm những địa điểm phù hợp cho hành trình sắp tới." to="/explore" link="Khám phá thêm" /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{data.destinations.slice(0, 4).map(item => <DestinationCard key={item.id} item={item} />)}</div></div></section>
    </>}
  </div>
}

function SectionHeading({ eyebrow, title, description, to, link }: { eyebrow: string; title: string; description: string; to: string; link: string }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-[#5D8BA5]">{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1E3A5F] sm:text-3xl">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p></div><DetailLink to={to}>{link}</DetailLink></div>
}
