import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Building2, LoaderCircle, LocateFixed, MapPin, X } from 'lucide-react'
import { buildHotelSearchOptions, type HotelSearchSelection } from '@/lib/hotel-search'
import type { Destination, Hotel } from '@/types/domain'

interface HotelDestinationSearchProps {
  value: string
  onChange: (value: string) => void
  onSelect: (selection: HotelSearchSelection) => void
  hotels: Hotel[]
  destinations: Destination[]
  isLoading?: boolean
  hasError?: boolean
  onRetry?: () => void
  className?: string
}

export function HotelDestinationSearch({ value, onChange, onSelect, hotels, destinations, isLoading, hasError, onRetry, className = '' }: HotelDestinationSearchProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const locatingRef = useRef(false)
  const locationRequestRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const options = useMemo(() => buildHotelSearchOptions(hotels, destinations, value === 'Gần tôi' ? '' : value), [hotels, destinations, value])
  const heading = value.trim() && value !== 'Gần tôi' ? 'Gợi ý phù hợp' : 'Điểm đến phổ biến'
  const optionCount = options.length + 1

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  useEffect(() => {
    if (open && activeIndex >= 0) document.getElementById(id + '-option-' + activeIndex)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, id])

  useEffect(() => () => { locatingRef.current = false; locationRequestRef.current += 1 }, [])

  const select = (selection: HotelSearchSelection) => {
    // Invalidate a pending location request if another destination is selected.
    locatingRef.current = false
    locationRequestRef.current += 1
    setLocating(false)
    setLocationError('')
    onSelect(selection)
    inputRef.current?.focus()
    setOpen(false)
    setActiveIndex(-1)
  }

  const locate = () => {
    if (locatingRef.current) return
    setLocationError('')
    if (!window.isSecureContext) {
      setLocationError('Mở website bằng HTTPS để sử dụng vị trí hiện tại, hoặc nhập điểm đến bên trên.')
      return
    }
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt chưa hỗ trợ định vị. Bạn có thể nhập thành phố hoặc tên khách sạn.')
      return
    }
    locatingRef.current = true
    const requestId = ++locationRequestRef.current
    setLocating(true)
    navigator.geolocation.getCurrentPosition(position => {
      if (!locatingRef.current || requestId !== locationRequestRef.current) return
      select({ kind: 'nearby', label: 'Gần tôi', lat: position.coords.latitude, lng: position.coords.longitude })
    }, error => {
      if (!locatingRef.current || requestId !== locationRequestRef.current) return
      locatingRef.current = false
      setLocating(false)
      setLocationError(error.code === 1 ? 'Bạn chưa cho phép truy cập vị trí. Hãy bật quyền vị trí của website rồi thử lại.'
        : error.code === 3 ? 'Lấy vị trí quá lâu. Hãy thử lại hoặc nhập điểm đến.'
          : 'Chưa xác định được vị trí hiện tại. Hãy thử lại hoặc nhập điểm đến.')
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex(index => !open || index < 0 ? event.key === 'ArrowDown' ? 0 : optionCount - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + optionCount) % optionCount)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      setActiveIndex(-1)
    } else if (event.key === 'Enter' && open && activeIndex >= 0 && activeIndex < optionCount) {
      event.preventDefault()
      if (activeIndex === 0) locate()
      else if (options[activeIndex - 1]) select(options[activeIndex - 1]!.selection)
    } else if (event.key === 'Enter') setOpen(false)
  }

  return <div ref={rootRef} className={'hotel-destination-search relative min-w-0 ' + className} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActiveIndex(-1) }
  }}>
    <label htmlFor={id} className="mb-1.5 block text-sm font-semibold leading-5 text-slate-700">Thành phố, địa điểm hoặc tên khách sạn</label>
    <div className={'hotel-destination-field relative flex items-center rounded-xl border-2 bg-white transition ' + (open ? 'border-lime-500 ring-2 ring-lime-500/20' : 'border-slate-300 hover:border-slate-400')}>
      <MapPin aria-hidden="true" size={24} className="pointer-events-none absolute left-3.5 shrink-0 text-slate-700" />
      <input ref={inputRef} id={id} role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? id + '-listbox' : undefined}
        aria-activedescendant={open && activeIndex >= 0 && activeIndex < optionCount ? id + '-option-' + activeIndex : undefined}
        aria-describedby={locationError ? id + '-location-error' : undefined}
        value={value} autoComplete="off" spellCheck={false} placeholder="Thành phố, khách sạn, điểm đến"
        className="!m-0 !min-h-[48px] !rounded-xl !border-0 !bg-transparent !py-3 !pl-12 !pr-10 !text-base !font-normal !shadow-none placeholder:text-slate-400"
        onFocus={() => { setOpen(true); setActiveIndex(-1) }} onClick={() => setOpen(true)} onKeyDown={onKeyDown}
        onChange={event => {
          locatingRef.current = false
          locationRequestRef.current += 1
          setLocating(false)
          setLocationError('')
          onChange(event.target.value)
          setActiveIndex(-1)
          setOpen(true)
        }} />
      {value && <button type="button" aria-label="Xóa điểm đến" className="absolute right-2 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-[#0071c2]" onClick={() => {
        locatingRef.current = false
        locationRequestRef.current += 1
        setLocating(false)
        setLocationError('')
        onChange('')
        setActiveIndex(-1)
        inputRef.current?.focus()
        setOpen(true)
      }}><X size={17} /></button>}
    </div>

    {open && <div className="hotel-destination-popover absolute left-0 top-full z-50 mt-2 w-[min(620px,calc(100vw-64px))] max-w-[calc(100vw-48px)] overflow-hidden rounded-2xl border border-slate-200 bg-[#fafdff] shadow-[0_12px_36px_-10px_rgba(15,23,42,.28)]">
      <div id={id + '-listbox'} role="listbox" aria-label="Gợi ý điểm đến và khách sạn" aria-busy={isLoading} className="max-h-[min(480px,60vh)] overflow-y-auto overscroll-contain p-3 sm:p-5">
        <button type="button" id={id + '-option-0'} role="option" aria-selected={activeIndex === 0} aria-disabled={locating} tabIndex={-1}
          className={'mb-5 flex w-full items-center gap-3 rounded-xl border px-4 py-4 text-left text-[#0071c2] transition focus-visible:outline-2 focus-visible:outline-[#0071c2] ' + (activeIndex === 0 ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50')}
          onMouseMove={() => setActiveIndex(0)} onClick={locate}>
          {locating ? <LoaderCircle size={25} aria-hidden="true" className="shrink-0 animate-spin" /> : <LocateFixed size={27} aria-hidden="true" className="shrink-0" />}
          <span><span className="block text-base font-semibold sm:text-lg">{locating ? 'Đang lấy vị trí...' : 'Gần tôi'}</span><span className="mt-0.5 block text-xs text-slate-500">Tìm khách sạn trong phạm vi 50 km</span></span>
        </button>
        {locationError && <p id={id + '-location-error'} role="alert" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-800">{locationError}</p>}
        <div role="presentation" className="mb-2 px-1 text-lg font-bold text-slate-950 sm:text-xl">{heading}</div>
        {isLoading ? <p role="status" className="flex items-center gap-2 px-1 py-6 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" />Đang tải điểm đến...</p>
          : hasError ? <div className="px-1 py-4 text-sm text-slate-600"><p>Chưa tải được danh sách. Bạn vẫn có thể nhập điểm đến để tìm kiếm.</p><button type="button" className="mt-2 font-semibold text-[#0071c2] hover:underline" onClick={onRetry}>Thử tải lại</button></div>
            : options.length ? options.map((option, index) => <button key={option.id} type="button" role="option" aria-selected={activeIndex === index + 1} id={id + '-option-' + (index + 1)} tabIndex={-1}
              className={'flex w-full items-center justify-between gap-3 border-b border-slate-200/80 px-2 py-4 text-left transition last:border-b-0 ' + (activeIndex === index + 1 ? 'rounded-lg bg-sky-50' : 'hover:rounded-lg hover:bg-sky-50')}
              onMouseMove={() => setActiveIndex(index + 1)} onClick={() => select(option.selection)}>
              <span className="min-w-0"><span className="flex items-center gap-2 text-base font-semibold text-slate-900">{option.selection.kind === 'hotel' && <Building2 size={17} className="shrink-0 text-slate-400" aria-hidden="true" />}<span className="truncate">{option.title}</span></span><span className="mt-1 block truncate text-sm font-normal text-slate-500">{option.subtitle}</span></span>
              <span className="shrink-0 text-right"><span className="inline-block rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-[#0071c2]">{option.badge}</span>{option.selection.kind !== 'hotel' && <span className="mt-1.5 block text-xs text-slate-500">{option.hotelCount.toLocaleString('vi-VN')} khách sạn</span>}</span>
            </button>) : <p role="status" className="px-1 py-5 text-sm leading-6 text-slate-500">Không có gợi ý phù hợp. Thử tên thành phố, khu vực hoặc khách sạn khác.</p>}
      </div>
    </div>}
  </div>
}
