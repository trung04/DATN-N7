import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, CalendarDays, MapPin, Search, Sparkles, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DetailLink, ErrorState, LoadingState } from '@/components/common'
import { DestinationCard, HotelCard, RestaurantCard } from './catalog'
import { useCatalog } from '@/hooks/data'
import { errorMessage, nights, todayPlus } from '@/lib/utils'
import { heroImage, travelImage } from '@/lib/travel-images'

const popularCities = ['Đà Nẵng', 'Đà Lạt', 'Huế', 'Quảng Nam']

export function HomePage() {
  const { data, isLoading, error } = useCatalog()
  const navigate = useNavigate()
  const [city, setCity] = useState('')
  const [checkIn, setCheckIn] = useState(todayPlus(7))
  const [checkOut, setCheckOut] = useState(todayPlus(9))
  const [adults, setAdults] = useState(2)
  const [searchError, setSearchError] = useState('')

  const searchHotels = (event: FormEvent) => {
    event.preventDefault()
    if (checkIn < todayPlus(0) || nights(checkIn, checkOut) < 1 || adults < 1) {
      setSearchError('Kiểm tra ngày nhận, trả phòng và số khách.')
      return
    }
    setSearchError('')
    navigate('/hotels?' + new URLSearchParams({ city: city.trim(), checkIn, checkOut, adults: String(adults), rooms: '1' }))
  }

  return <div className="bg-white">
    <section className="container-travel pt-6 md:pt-8">
      <div className="relative overflow-hidden rounded-[28px] bg-[#1E3A5F] text-white">
        <img src={heroImage} alt="Ảnh minh họa bờ biển Đà Nẵng" className="absolute inset-0 h-full w-full object-cover object-center opacity-65" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102947]/95 via-[#173858]/80 to-[#173858]/10" />
        <div className="relative max-w-[820px] px-6 py-14 sm:px-10 md:py-20 lg:px-16 lg:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur"><Sparkles size={15} />Khám phá Việt Nam theo cách của bạn</span>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">Khám phá hành trình phù hợp với bạn</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/90 sm:text-lg">Tìm nơi ở, chọn trải nghiệm yêu thích và sắp xếp từng ngày thành một chuyến đi thật dễ hình dung.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg" className="bg-white text-[#1E3A5F] hover:bg-slate-100"><Link to="/ai/trip-planner"><Sparkles size={18} />Lập lịch trình với AI demo</Link></Button><Button asChild size="lg" variant="secondary" className="border-white/40 bg-white/10 text-white hover:bg-white/20"><Link to="/explore">Khám phá điểm đến<ArrowRight size={17} /></Link></Button></div>
        </div>
      </div>
      <form onSubmit={searchHotels} className="relative mx-4 -mt-5 grid sm:mx-8 lg:mx-12 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_-22px_rgba(30,58,95,.35)] sm:p-5 lg:grid-cols-[1.4fr_1fr_1fr_.7fr_auto] lg:items-end">
        <label className="text-sm font-semibold text-[#1E3A5F]"><span className="inline-flex items-center gap-1.5"><MapPin size={15} />Điểm đến</span><input value={city} onChange={e => setCity(e.target.value)} placeholder="Bạn muốn đi đâu?" list="home-cities" /><datalist id="home-cities">{popularCities.map(x => <option key={x} value={x} />)}</datalist></label>
        <label className="text-sm font-semibold text-[#1E3A5F]"><span className="inline-flex items-center gap-1.5"><CalendarDays size={15} />Nhận phòng</span><input type="date" value={checkIn} min={todayPlus(0)} onChange={e => setCheckIn(e.target.value)} /></label>
        <label className="text-sm font-semibold text-[#1E3A5F]"><span className="inline-flex items-center gap-1.5"><CalendarDays size={15} />Trả phòng</span><input type="date" value={checkOut} min={checkIn} onChange={e => setCheckOut(e.target.value)} /></label>
        <label className="text-sm font-semibold text-[#1E3A5F]"><span className="inline-flex items-center gap-1.5"><UsersRound size={15} />Số khách</span><input type="number" min="1" max="12" value={adults} onChange={e => setAdults(Number(e.target.value))} /></label>
        <Button size="lg" className="h-11 w-full lg:w-auto"><Search size={18} />Tìm khách sạn</Button>
        {searchError && <p role="alert" className="text-sm text-red-700 lg:col-span-5">{searchError}</p>}
      </form>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm"><span className="mr-1 text-slate-500">Điểm đến được yêu thích:</span>{popularCities.map(x => <Link key={x} to={'/explore?city=' + encodeURIComponent(x)} className="rounded-full border border-slate-200 px-3 py-1.5 text-[#1E3A5F] hover:border-[#1E3A5F] hover:bg-[#EAF0F6]">{x}</Link>)}</div>
    </section>

    {isLoading ? <LoadingState /> : error ? <div className="container-travel section-pad"><ErrorState message={errorMessage(error)} /></div> : data && <>
      <section className="container-travel section-pad">
        <SectionHeading eyebrow="Truyền cảm hứng" title="Bắt đầu từ một nơi bạn muốn đến" description="Từ biển xanh đến phố cổ, chọn điểm đến rồi tạo hành trình của riêng bạn." to="/explore" link="Xem tất cả" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{popularCities.map(cityName => {
          const count = data.destinations.filter(place => place.city === cityName).length
          return <Link key={cityName} to={'/explore?city=' + encodeURIComponent(cityName)} className="group relative flex min-h-64 items-end overflow-hidden rounded-2xl bg-slate-200 p-5 text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"><img src={travelImage(cityName)} alt={'Ảnh minh họa ' + cityName} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /><span className="absolute inset-0 bg-gradient-to-t from-[#102947]/85 via-transparent to-transparent" /><span className="relative"><strong className="block text-xl">{cityName}</strong><span className="text-sm text-white/85">{count} địa điểm trong danh mục</span></span><ArrowRight className="relative ml-auto" size={18} /></Link>
        })}</div>
      </section>
      <section className="bg-[#F7F9FC]"><div className="container-travel section-pad">
        <SectionHeading eyebrow="Lên đường dễ hơn" title="Lịch trình theo sở thích của bạn" description="Chọn ngày, ngân sách và điều bạn thích. Bản demo dùng địa điểm có thật trong danh mục để sắp xếp lịch theo giờ mở cửa." to="/ai/trip-planner" link="Bắt đầu lập lịch trình" />
        <div className="grid gap-4 md:grid-cols-3">{[
          ['01', 'Chọn chuyến đi', 'Điểm đến, ngày đi, số khách và ngân sách.'],
          ['02', 'Xem gợi ý từng ngày', 'Biết vì sao địa điểm được chọn và chi phí dự kiến.'],
          ['03', 'Tinh chỉnh rồi lưu', 'Đổi nhịp độ, sửa hoạt động và lưu vào chuyến đi.'],
        ].map(([number, title, text]) => <div key={number} className="rounded-2xl border border-slate-200 bg-white p-6"><span className="text-sm font-bold text-[#5D8BA5]">{number}</span><h3 className="mt-4 text-lg font-semibold text-[#1E3A5F]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}</div>
      </div></section>
      <section className="container-travel section-pad"><SectionHeading eyebrow="Nơi ở" title="Khách sạn cho hành trình sắp tới" description="So sánh tiện nghi và mức giá trước khi chọn phòng." to="/hotels" link="Tìm khách sạn" /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{data.hotels.slice(0, 4).map(item => <HotelCard key={item.id} item={item} price={Math.min(...data.rooms.filter(room => room.hotelId === item.id).map(room => room.basePrice))} />)}</div></section>
      <section className="bg-[#F7F9FC]"><div className="container-travel section-pad"><SectionHeading eyebrow="Trải nghiệm" title="Một chuyến đi, nhiều điều để nhớ" description="Địa điểm và hương vị địa phương đang chờ bạn khám phá." to="/explore" link="Khám phá thêm" /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{data.destinations.slice(0, 2).map(item => <DestinationCard key={item.id} item={item} />)}{data.restaurants.slice(0, 2).map(item => <RestaurantCard key={item.id} item={item} />)}</div></div></section>
    </>}
  </div>
}

function SectionHeading({ eyebrow, title, description, to, link }: { eyebrow: string; title: string; description: string; to: string; link: string }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-[#5D8BA5]">{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1E3A5F] sm:text-3xl">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p></div><DetailLink to={to}>{link}</DetailLink></div>
}
