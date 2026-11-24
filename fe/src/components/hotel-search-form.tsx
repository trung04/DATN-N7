import type { FormEventHandler, ReactNode } from 'react'
import { CalendarDays, Search, SlidersHorizontal, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { readChildAges } from '@/lib/room-occupancy'
import { todayPlus } from '@/lib/utils'

const MAX_SEARCH_CHILDREN = 10
interface HotelSearchFormProps {
  values: URLSearchParams
  onChange: (values: Record<string, string>) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  destination: ReactNode
  availableAmenities: string[]
  className?: string
  error?: string
}

export function HotelSearchForm({ values, onChange: updateMany, onSubmit, destination, availableAmenities, className = '', error }: HotelSearchFormProps) {
  const checkIn = values.get('checkIn') ?? todayPlus(7)
  const checkOut = values.get('checkOut') ?? todayPlus(9)
  const adults = Math.max(1, Math.min(12, Number(values.get('adults')) || 2))
  const children = Math.max(0, Math.min(MAX_SEARCH_CHILDREN, Number(values.get('children')) || 0))
  const rooms = Math.max(1, Math.min(5, Number(values.get('rooms')) || 1))
  const childAges = readChildAges(values.get('childAges'), children)
  const stars = Number(values.get('stars') ?? 0)
  const minRating = Number(values.get('minRating') ?? 0)
  const maxPrice = Number(values.get('maxPrice') ?? 0)
  const selectedAmenities = (values.get('amenities') ?? '').split('|').filter(Boolean)
  const activeFilterCount = Number(stars > 0) + Number(minRating > 0) + Number(maxPrice > 0) + selectedAmenities.length
  const update = (key: string, value: string) => updateMany({ [key]: value })
  const updateChildCount = (count: number) => {
    const ages = childAges.slice(0, count)
    while (ages.length < count) ages.push(5)
    updateMany({ children: String(count), childAges: ages.join(',') })
  }
  const toggleAmenity = (amenity: string) => {
    const nextAmenities = selectedAmenities.includes(amenity)
      ? selectedAmenities.filter(item => item !== amenity)
      : [...selectedAmenities, amenity]
    update('amenities', nextAmenities.join('|'))
  }

  return <form className={'hotel-search-card relative z-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_55px_-32px_rgba(17,49,64,.42)] sm:p-6 ' + className} onSubmit={onSubmit}>
      <div className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-[minmax(280px,2fr)_1fr_1fr_90px_76px_76px_112px]">
        {destination}
        <label className="block min-w-0 text-sm font-semibold text-slate-700"><span className="inline-flex items-center gap-2"><CalendarDays size={16} className="text-[#176b70]" />Nhận phòng</span><input type="date" min={todayPlus(0)} value={checkIn} onChange={event => { const value = event.target.value; if (value >= checkOut) { const nextDate = new Date(value + 'T12:00:00'); nextDate.setDate(nextDate.getDate() + 1); updateMany({ checkIn: value, checkOut: nextDate.toISOString().slice(0, 10) }) } else update('checkIn', value) }} /></label>
        <label className="block min-w-0 text-sm font-semibold text-slate-700"><span className="inline-flex items-center gap-2"><CalendarDays size={16} className="text-[#176b70]" />Trả phòng</span><input type="date" min={checkIn} value={checkOut} onChange={event => update('checkOut', event.target.value)} /></label>
        <label className="block text-sm font-semibold text-slate-700"><span className="inline-flex items-center gap-2 whitespace-nowrap"><Users size={16} className="text-[#176b70]" />Người lớn</span><select aria-label="Người lớn" value={adults} onChange={event => update('adults', event.target.value)}>{Array.from({ length: 12 }, (_, index) => index + 1).map(value => <option value={value} key={value}>{value}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">Số phòng<select aria-label="Số phòng" value={rooms} onChange={event => update('rooms', event.target.value)}>{Array.from({ length: 5 }, (_, index) => index + 1).map(value => <option value={value} key={value}>{value}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">Trẻ em<select aria-label="Trẻ em" value={children} onChange={event => updateChildCount(Number(event.target.value))}>{Array.from({ length: MAX_SEARCH_CHILDREN + 1 }, (_, value) => <option value={value} key={value}>{value}</option>)}</select></label>
        <div className="flex items-end"><Button className="h-[43px] w-full whitespace-nowrap rounded-lg px-2" type="submit"><Search size={17} />Tìm phòng</Button></div>
      </div>

      {children > 0 && <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-800">Độ tuổi trẻ em</h2><p className="mt-1 text-xs text-slate-500">Nhập đúng tuổi để kiểm tra giới hạn và phụ thu của từng loại phòng.</p></div><span className="rounded-full bg-[#edf6f3] px-3 py-1 text-xs font-medium text-[#176b70]">{children} trẻ em</span></div>
        <div className="flex flex-wrap gap-3">{childAges.map((age, index) => <label className="w-[calc(50%-6px)] max-w-40 text-xs font-medium text-slate-600 sm:w-32" key={index}>Trẻ em {index + 1}<select className="mt-1.5" aria-label={`Tuổi trẻ em ${index + 1}`} value={age} onChange={event => { const ages = [...childAges]; ages[index] = Number(event.target.value); update('childAges', ages.join(',')) }}>{Array.from({ length: 18 }, (_, value) => <option key={value} value={value}>{value} tuổi</option>)}</select></label>)}</div>
        <p className="mt-3 text-xs text-slate-500">Khách từ 12 tuổi trở lên có thể được tính là người lớn tùy chính sách khách sạn.</p>
      </div>}

      <details className="mt-5 border-t border-slate-100 pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700"><span className="inline-flex items-center gap-2"><SlidersHorizontal size={17} className="text-[#176b70]" />Bộ lọc khách sạn</span><span className="flex items-center gap-2 text-xs font-medium text-slate-500">{activeFilterCount ? `${activeFilterCount} bộ lọc đang bật` : 'Hạng sao, đánh giá, giá và tiện nghi'}<span aria-hidden="true">⌄</span></span></summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">Hạng sao<select aria-label="Hạng sao" value={stars} onChange={event => update('stars', event.target.value)}><option value="0">Tất cả</option><option value="3">Từ 3 sao</option><option value="4">Từ 4 sao</option><option value="5">5 sao</option></select></label>
          <label className="text-sm font-medium text-slate-700">Đánh giá tối thiểu<select aria-label="Đánh giá tối thiểu" value={minRating} onChange={event => update('minRating', event.target.value)}><option value="0">Tất cả đánh giá</option><option value="3">Từ 3.0 / 5</option><option value="4">Từ 4.0 / 5</option><option value="4.5">Từ 4.5 / 5</option></select></label>
          <label className="text-sm font-medium text-slate-700">Giá tối đa / phòng / đêm<select aria-label="Giá tối đa / phòng / đêm" value={maxPrice} onChange={event => update('maxPrice', event.target.value)}><option value="0">Không giới hạn</option><option value="1000000">1.000.000 ₫</option><option value="1500000">1.500.000 ₫</option><option value="2500000">2.500.000 ₫</option><option value="4000000">4.000.000 ₫</option></select></label>
          {availableAmenities.length > 0 && <fieldset className="sm:col-span-2 lg:col-span-3"><legend className="mb-2 text-sm font-medium text-slate-700">Tiện nghi khách sạn</legend><div className="flex flex-wrap gap-2">{availableAmenities.map(amenity => <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${selectedAmenities.includes(amenity) ? 'border-[#176b70] bg-[#edf6f3] text-[#10545b]' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`} key={amenity}><input type="checkbox" checked={selectedAmenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} />{amenity}</label>)}</div></fieldset>}
        </div>
        {activeFilterCount > 0 && <button className="mt-4 text-sm font-semibold text-[#176b70] hover:underline" type="button" onClick={() => updateMany({ stars: '', minRating: '', maxPrice: '', amenities: '' })}>Xóa bộ lọc nâng cao</button>}
      </details>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </form>
}
