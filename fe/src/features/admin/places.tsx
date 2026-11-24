import { useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { api } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'
import type { AdminPlace, PlaceAdminInput, PlaceAdminListItem, PlaceCatalogOptions, PlaceStatus } from '@/types/domain'

const blankForm = (): PlaceAdminInput => ({
  name: '', city: '', description: '', address: '', countryCode: 'VN', provinceCode: '',
  timezone: 'Asia/Ho_Chi_Minh', latitude: 16.0678, longitude: 108.2208,
  status: 'ACTIVE', openingTime: '', categoryCode: '', topicCodes: [], imageUrl: '',
  imageAltText: '', referencePrice: { minPrice: 0, maxPrice: 0, currency: 'VND', pricingUnit: 'người', description: '' },
})

function fromPlace(place: AdminPlace): PlaceAdminInput {
  return {
    name: place.name, city: place.city ?? '', description: place.description ?? '', address: place.address ?? '',
    countryCode: place.countryCode ?? 'VN', provinceCode: place.provinceCode ?? '', timezone: place.timezone ?? 'Asia/Ho_Chi_Minh',
    latitude: place.latitude ?? 0, longitude: place.longitude ?? 0, status: place.status,
    openingTime: place.openingHours?.display ?? '', categoryCode: place.categories[0]?.code ?? '',
    topicCodes: [],
    imageUrl: place.images.find(image => image.isPrimary)?.imageUrl ?? place.images[0]?.imageUrl ?? '',
    imageAltText: place.images.find(image => image.isPrimary)?.altText ?? place.images[0]?.altText ?? '',
    referencePrice: place.price ? { minPrice: place.price.minPrice, maxPrice: place.price.maxPrice, currency: place.price.currency, pricingUnit: place.price.pricingUnit, description: place.price.description ?? '' } : null,
  }
}

export function AdminPlacesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | PlaceStatus>('')
  const [editing, setEditing] = useState<AdminPlace | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<PlaceAdminListItem | null>(null)
  const [form, setForm] = useState<PlaceAdminInput>(blankForm)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const places = useQuery({ queryKey: ['admin-places', search, statusFilter], queryFn: () => api.adminPlaces({ search: search.trim() || undefined, status: statusFilter || undefined }) })
  const options = useQuery({ queryKey: ['place-catalog-options'], queryFn: api.placeCatalogOptions })
  const optionData: PlaceCatalogOptions = options.data ?? { categories: [], topics: [] }
  const categoryNames = useMemo(() => new Map(optionData.categories.map(item => [item.code, item.name])), [optionData.categories])

  const openNew = () => { setEditing(null); setForm(blankForm()); setError(''); setFormOpen(true) }
  const openEdit = async (item: PlaceAdminListItem) => {
    setBusy(true); setError('')
    try {
      const detail = await api.adminPlace(item.id)
      const initial = fromPlace(detail)
      initial.topicCodes = detail.tags.flatMap(tag => optionData.topics.filter(topic => topic.name === tag).map(topic => topic.code))
      setEditing(detail); setForm(initial); setFormOpen(true)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-places'] })
    await queryClient.invalidateQueries({ queryKey: ['catalog'] })
  }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('')
    const payload: PlaceAdminInput = {
      ...form, name: form.name.trim(), city: form.city.trim(), address: form.address.trim(), description: form.description.trim(),
      countryCode: form.countryCode.trim().toUpperCase(), provinceCode: form.provinceCode.trim().toUpperCase(),
      categoryCode: form.categoryCode || optionData.categories[0]?.code || '',
      imageUrl: form.imageUrl?.trim() || null, imageAltText: form.imageAltText?.trim() || null,
      referencePrice: form.referencePrice ? { ...form.referencePrice, pricingUnit: form.referencePrice.pricingUnit.trim() || 'người', description: form.referencePrice.description.trim() } : null,
    }
    const requestPayload = {
      ...payload,
      address: payload.address || null,
      description: payload.description || null,
      openingTime: payload.openingTime || null,
    }
    try {
      if (editing) await api.updatePlace(editing.id, requestPayload)
      else await api.createPlace(requestPayload)
      await refresh(); setFormOpen(false); setEditing(null); setNotice(editing ? 'Đã cập nhật điểm đến.' : 'Đã thêm điểm đến.')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!deleting) return
    setBusy(true); setError('')
    try { await api.deletePlace(deleting.id); await refresh(); setDeleting(null); setNotice('Đã xóa điểm đến.') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  if (places.isPending || options.isPending) return <LoadingState />
  if (places.isError) return <ErrorState message={errorMessage(places.error)} retry={() => { void places.refetch() }} />
  if (options.isError) return <ErrorState message={errorMessage(options.error)} retry={() => { void options.refetch() }} />

  return <div>
    <PageHeader title="Điểm đến" description="Quản lý thông tin điểm đến, ảnh, chủ đề và giá tham khảo." actions={<Button onClick={openNew}><Plus size={16} />Thêm điểm đến</Button>} />
    <Feedback message={notice} />
    {error && !formOpen && !deleting && <Feedback message={error} kind="error" />}
    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
      <label className="relative flex-1"><span className="sr-only">Tìm điểm đến</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="w-full pl-10" placeholder="Tìm tên, thành phố hoặc địa chỉ" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <select aria-label="Lọc trạng thái" className="sm:w-48" value={statusFilter} onChange={event => setStatusFilter(event.target.value as '' | PlaceStatus)}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select>
    </div>
    {places.data.data.length ? <Card className="mt-4 table-scroll"><table><thead><tr><th>Điểm đến</th><th>Thành phố</th><th>Loại hình</th><th>Giá tham khảo</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{places.data.data.map(place => <tr key={place.id}>
      <td><div className="flex min-w-[230px] items-center gap-3">{place.primaryImageUrl ? <img src={place.primaryImageUrl} alt="" className="h-12 w-16 rounded-md object-cover" /> : <span className="flex h-12 w-16 items-center justify-center rounded-md bg-slate-100 text-slate-400"><MapPin size={19} /></span>}<span className="font-semibold">{place.name}</span></div></td>
      <td>{place.city || '—'}</td><td>{categoryNames.get(place.category ?? '') ?? place.category ?? '—'}</td>
      <td>{place.price?.isFree ? 'Miễn phí' : place.price ? `${new Intl.NumberFormat('vi-VN').format(place.price.minPrice)}${place.price.maxPrice !== place.price.minPrice ? `–${new Intl.NumberFormat('vi-VN').format(place.price.maxPrice)}` : ''} ${place.price.currency}` : 'Chưa có giá'}</td>
      <td><span className={place.status === 'ACTIVE' ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600'}>{place.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></td>
      <td><div className="flex gap-3 whitespace-nowrap"><button className="font-semibold text-[#1E3A5F] disabled:opacity-50" disabled={busy} onClick={() => { void openEdit(place) }}>Chỉnh sửa</button><button className="text-red-700" aria-label={`Xóa ${place.name}`} onClick={() => { setDeleting(place); setError('') }}><Trash2 size={16} /></button></div></td>
    </tr>)}</tbody></table></Card> : <EmptyState title="Chưa có điểm đến phù hợp" action={<Button onClick={openNew}><Plus size={16} />Thêm điểm đến</Button>} />}

    <Dialog open={formOpen} onOpenChange={open => { setFormOpen(open); if (!open) { setEditing(null); setError('') } }}>
      <DialogContent title={editing ? 'Chỉnh sửa điểm đến' : 'Thêm điểm đến'}>
        <form className="grid max-h-[75vh] gap-4 overflow-y-auto pr-1" onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Tên điểm đến"><input required maxLength={200} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></FormField>
            <FormField label="Thành phố"><input required maxLength={120} value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} /></FormField>
          </div>
          <FormField label="Địa chỉ"><input maxLength={500} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></FormField>
          <FormField label="Mô tả"><textarea rows={3} maxLength={10000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Loại hình"><select required value={form.categoryCode} onChange={event => setForm({ ...form, categoryCode: event.target.value })}><option value="">Chọn loại hình</option>{optionData.categories.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></FormField>
            <FormField label="Tỉnh/thành (mã)"><input required pattern="[A-Za-z0-9-]{1,20}" maxLength={20} placeholder="DN" value={form.provinceCode} onChange={event => setForm({ ...form, provinceCode: event.target.value.toUpperCase() })} /></FormField>
            <FormField label="Múi giờ"><input required value={form.timezone} onChange={event => setForm({ ...form, timezone: event.target.value })} /></FormField>
          </div>
          <fieldset><legend className="mb-2 text-sm font-medium">Chủ đề</legend><div className="grid gap-2 sm:grid-cols-3">{optionData.topics.map(topic => <label key={topic.code} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.topicCodes.includes(topic.code)} onChange={event => setForm({ ...form, topicCodes: event.target.checked ? [...form.topicCodes, topic.code] : form.topicCodes.filter(code => code !== topic.code) })} />{topic.name}</label>)}</div></fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Vĩ độ"><input required type="number" min={-90} max={90} step="any" value={form.latitude} onChange={event => setForm({ ...form, latitude: Number(event.target.value) })} /></FormField>
            <FormField label="Kinh độ"><input required type="number" min={-180} max={180} step="any" value={form.longitude} onChange={event => setForm({ ...form, longitude: Number(event.target.value) })} /></FormField>
          </div>
          <FormField label="Giờ mở cửa / ghi chú"><input maxLength={255} placeholder="Ví dụ: 07:00–17:30" value={form.openingTime} onChange={event => setForm({ ...form, openingTime: event.target.value })} /></FormField>
          <FormField label="Đường dẫn ảnh chính" hint="Dùng URL https://... hoặc ảnh có sẵn trong /images/."><input pattern="(https?://|/images/).*" value={form.imageUrl ?? ''} onChange={event => setForm({ ...form, imageUrl: event.target.value })} /></FormField>
          {form.imageUrl && <img src={form.imageUrl} alt="Xem trước ảnh điểm đến" className="h-40 w-full rounded-lg object-cover" onError={event => { event.currentTarget.style.display = 'none' }} />}
          <FormField label="Mô tả ảnh"><input maxLength={255} value={form.imageAltText ?? ''} onChange={event => setForm({ ...form, imageAltText: event.target.value })} /></FormField>
          <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"><legend className="px-1 text-sm font-semibold">Giá tham khảo</legend>
            <FormField label="Giá thấp nhất (VND)"><input required type="number" min={0} step="1000" value={form.referencePrice?.minPrice ?? 0} onChange={event => setForm({ ...form, referencePrice: { ...(form.referencePrice ?? { minPrice: 0, maxPrice: 0, currency: 'VND', pricingUnit: 'người', description: '' }), minPrice: Number(event.target.value) } })} /></FormField>
            <FormField label="Giá cao nhất (VND)"><input required type="number" min={0} step="1000" value={form.referencePrice?.maxPrice ?? 0} onChange={event => setForm({ ...form, referencePrice: { ...(form.referencePrice ?? { minPrice: 0, maxPrice: 0, currency: 'VND', pricingUnit: 'người', description: '' }), maxPrice: Number(event.target.value) } })} /></FormField>
            <FormField label="Đơn vị tính"><input required maxLength={60} value={form.referencePrice?.pricingUnit ?? ''} onChange={event => setForm({ ...form, referencePrice: { ...(form.referencePrice ?? { minPrice: 0, maxPrice: 0, currency: 'VND', pricingUnit: 'người', description: '' }), pricingUnit: event.target.value } })} /></FormField>
            <FormField label="Ghi chú về giá"><input maxLength={2000} value={form.referencePrice?.description ?? ''} onChange={event => setForm({ ...form, referencePrice: { ...(form.referencePrice ?? { minPrice: 0, maxPrice: 0, currency: 'VND', pricingUnit: 'người', description: '' }), description: event.target.value } })} /></FormField>
          </fieldset>
          <FormField label="Trạng thái"><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as PlaceStatus })}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></FormField>
          <Feedback message={error} kind="error" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Đóng</Button><Button disabled={busy || !optionData.categories.length}>{busy ? 'Đang lưu...' : 'Lưu điểm đến'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null) }}><DialogContent title="Xóa điểm đến?" description={`${deleting?.name} sẽ bị ẩn khỏi danh sách điểm đến.`}><Feedback message={error} kind="error" /><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Đóng</Button><Button variant="danger" disabled={busy} onClick={() => { void remove() }}><Trash2 size={16} />{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</Button></div></DialogContent></Dialog>
  </div>
}
