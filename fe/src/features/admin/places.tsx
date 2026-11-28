import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { MapPin, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { ManagementSearch, SearchButton } from '@/components/management-search'
import { useSearchFilters } from '@/lib/use-search-filters'
import { Pagination } from '@/components/pagination'
import { readPage, readPageSize } from '@/lib/pagination'
import { usePagination } from '@/lib/use-pagination'
import { api, apiAssetUrl } from '@/services/api/client'
import { PlaceEditor } from './place-editor'
import { errorMessage } from '@/lib/utils'
import type { AdminPlace, PlaceAdminInput, PlaceAdminListItem, PlaceAdminRequest, PlaceCatalogOptions } from '@/types/domain'

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
  const [params, setParams] = useSearchParams()
  const page = readPage(params)
  const size = readPageSize(params)
  const search = params.get('q') ?? ''
  const statusParam = params.get('status')
  const statusFilter = statusParam === 'ACTIVE' || statusParam === 'INACTIVE' ? statusParam : undefined
  const { filters, changeFilters, applyFilters } = useSearchFilters(params, setParams, { q: search.trim(), status: statusFilter ?? '' })
  const [editing, setEditing] = useState<AdminPlace | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<PlaceAdminListItem | null>(null)
  const [form, setForm] = useState<PlaceAdminInput>(blankForm)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const places = useQuery({ queryKey: ['admin-places', page, size, search.trim(), statusFilter], queryFn: () => api.adminPlaces({ page, limit: size, search: search.trim() || undefined, status: statusFilter }), placeholderData: keepPreviousData })
  const pagination = usePagination(places.isPlaceholderData ? undefined : places.data?.meta.total)
  const options = useQuery({ queryKey: ['place-catalog-options'], queryFn: api.placeCatalogOptions })
  const optionData: PlaceCatalogOptions = options.data ?? { cities: [], categories: [], topics: [] }
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
  const save = async (input: PlaceAdminRequest, image?: File) => {
    setBusy(true); setError('')
    try {
      if (editing) await api.updatePlace(editing.id, input, image)
      else await api.createPlace(input, image)
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
  if (options.isPending) return <LoadingState />
  if (options.isError) return <ErrorState message={errorMessage(options.error)} retry={() => { void options.refetch() }} />

  return <div className="management-list">
    <PageHeader title="Điểm đến" description="Quản lý thông tin điểm đến, ảnh, chủ đề và giá tham khảo." actions={<Button onClick={openNew}><Plus size={16} />Thêm điểm đến</Button>} />
    <Feedback message={notice} />
    {error && !formOpen && !deleting && <Feedback message={error} kind="error" />}
    <form aria-label="Tìm kiếm điểm đến" onSubmit={applyFilters} className="management-filters grid items-end gap-2 rounded-xl border border-slate-200 bg-white sm:grid-cols-[minmax(0,1fr)_minmax(140px,220px)_auto]">
      <FormField label="Tìm điểm đến"><ManagementSearch placeholder="Tìm tên, thành phố hoặc địa chỉ" value={filters.q} onChange={event => changeFilters({ q: event.target.value })} /></FormField>
      <FormField label="Trạng thái"><select value={filters.status} onChange={event => changeFilters({ status: event.target.value })}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></FormField>
      <SearchButton />
    </form>
    {places.isPending ? <LoadingState /> : places.isError ? <ErrorState message={errorMessage(places.error)} retry={() => { void places.refetch() }} /> : places.data.data.length ? <Card className="table-scroll"><table><thead><tr><th>Điểm đến</th><th>Thành phố</th><th>Loại hình</th><th>Giá tham khảo</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{places.data.data.map(place => <tr key={place.id}>
      <td><div className="flex min-w-[230px] items-center gap-3">{place.primaryImageUrl ? <img src={place.primaryImageUrl.startsWith('/api/') ? apiAssetUrl(place.primaryImageUrl) : place.primaryImageUrl} alt="" className="h-12 w-16 rounded-md object-cover" /> : <span className="flex h-12 w-16 items-center justify-center rounded-md bg-slate-100 text-slate-400"><MapPin size={19} /></span>}<span className="font-semibold">{place.name}</span></div></td>
      <td>{place.city || '—'}</td><td>{categoryNames.get(place.category ?? '') ?? place.category ?? '—'}</td>
      <td>{place.price?.isFree ? 'Miễn phí' : place.price ? `${new Intl.NumberFormat('vi-VN').format(place.price.minPrice)}${place.price.maxPrice !== place.price.minPrice ? `–${new Intl.NumberFormat('vi-VN').format(place.price.maxPrice)}` : ''} ${place.price.currency}` : 'Chưa có giá'}</td>
      <td><span className={place.status === 'ACTIVE' ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600'}>{place.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></td>
      <td><div className="flex gap-3 whitespace-nowrap"><button className="font-semibold text-[#1E3A5F] disabled:opacity-50" disabled={busy} onClick={() => { void openEdit(place) }}>Chỉnh sửa</button><button className="text-red-700" aria-label={`Xóa ${place.name}`} onClick={() => { setDeleting(place); setError('') }}><Trash2 size={16} /></button></div></td>
    </tr>)}</tbody></table></Card> : <EmptyState title="Chưa có điểm đến phù hợp" action={<Button onClick={openNew}><Plus size={16} />Thêm điểm đến</Button>} />}
    {places.data && <Pagination page={page} total={places.data.meta.total} onPageChange={pagination.setPage} size={size} onSizeChange={pagination.setSize} />}

    {formOpen && <PlaceEditor
      initial={form}
      editing={Boolean(editing)}
      options={optionData}
      busy={busy}
      error={error}
      onClose={() => { setFormOpen(false); setEditing(null); setError('') }}
      onSave={save}
    />}
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null) }}><DialogContent title="Xóa điểm đến?" description={`${deleting?.name} sẽ bị ẩn khỏi danh sách điểm đến.`}><Feedback message={error} kind="error" /><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Đóng</Button><Button variant="danger" disabled={busy} onClick={() => { void remove() }}><Trash2 size={16} />{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</Button></div></DialogContent></Dialog>
  </div>
}
