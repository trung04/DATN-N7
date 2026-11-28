import { SearchButton } from '@/components/management-search'
import { HotelManagementLocked } from '@/components/hotel-management-locked'
import { useSearchFilters } from '@/lib/use-search-filters'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { CancellationPolicyTerms } from '@/components/cancellation-policy-terms'
import { Pagination } from '@/components/pagination'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DialogPagination, DialogSections } from '@/components/ui/dialog-sections'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { fetchAllPages, pageItems, PAGE_SIZE } from '@/lib/pagination'
import { usePagination } from '@/lib/use-pagination'
import { errorMessage } from '@/lib/utils'
import { api } from '@/services/api/client'
import { loadHotelOptions } from '@/services/api/management-options'
import type { CancellationPolicy, CancellationPolicyTier } from '@/types/domain'

type TierRow = { id: number; hours: string; fee: string }

function initialTiers(policy: CancellationPolicy | null): CancellationPolicyTier[] {
  if (!policy) return []
  if (policy.tiers) return policy.tiers
  if (!policy.cancellationAllowed) return [{ upToHours: null, feePercent: null }]
  return [
    ...(policy.cancelHours > 0 ? [{ upToHours: policy.cancelHours, feePercent: 0 }] : []),
    { upToHours: null, feePercent: policy.penaltyPercent },
  ]
}

function readTiers(rows: TierRow[], tailFee: string, noCancellationAfterLast: boolean): {
  tiers?: CancellationPolicyTier[]
  error?: string
} {
  const finite = rows.map(row => ({ upToHours: Number(row.hours), feePercent: Number(row.fee) }))
  if (rows.some((row, index) => !row.hours.trim() || !Number.isInteger(finite[index]?.upToHours) ||
    finite[index]!.upToHours < 0 || finite[index]!.upToHours > 87600)) {
    return { error: 'Nhập hạn cuối là số giờ nguyên từ 0 đến 87.600 cho từng mốc.' }
  }
  const fees = [...rows.map(row => row.fee), ...(noCancellationAfterLast ? [] : [tailFee])]
  if (fees.some(fee => !/^\d+(?:\.\d{1,2})?$/.test(fee) || Number(fee) > 100)) {
    return { error: 'Nhập phí hủy từ 0% đến 100%, tối đa hai chữ số thập phân.' }
  }
  finite.sort((left, right) => left.upToHours - right.upToHours)
  if (finite.some((tier, index) => index > 0 && tier.upToHours === finite[index - 1]?.upToHours)) {
    return { error: 'Mỗi mốc cần có một hạn cuối khác nhau.' }
  }
  return { tiers: [...finite, { upToHours: null, feePercent: noCancellationAfterLast ? null : Number(tailFee) }] }
}

function PolicyEditor({ policy, hotelId, hotelName, canActivate, onSaved, onClose }: {
  policy: CancellationPolicy | null
  hotelId: string
  hotelName: string
  canActivate: boolean
  onSaved: () => Promise<void>
  onClose: () => void
}) {
  const initial = initialTiers(policy)
  const [name, setName] = useState(policy?.name ?? '')
  const [description, setDescription] = useState(policy?.description ?? '')
  const [active, setActive] = useState(policy?.isActive ?? canActivate)
  const [rows, setRows] = useState<TierRow[]>(() => policy
    ? initial.filter(tier => tier.upToHours !== null).map((tier, index) => ({ id: index, hours: String(tier.upToHours), fee: String(tier.feePercent) }))
    : [{ id: 0, hours: '', fee: '' }])
  const tail = initial.at(-1)
  const [tailFee, setTailFee] = useState(tail?.feePercent?.toString() ?? '')
  const [noCancellationAfterLast, setNoCancellationAfterLast] = useState(tail?.feePercent === null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const formId = useId()
  const [tierPage, setTierPage] = useState(0)
  const nextId = useRef(rows.length)
  const preview = readTiers(rows, tailFee, noCancellationAfterLast)
  const lastHour = preview.tiers?.at(-2)?.upToHours
  const validHours = rows.map(row => row.hours.trim() ? Number(row.hours) : NaN)
    .filter(value => Number.isInteger(value) && value >= 0 && value <= 87600)
  const highestHour = lastHour ?? (validHours.length > 0 ? Math.max(...validHours) : undefined)

  function updateRow(id: number, field: 'hours' | 'fee', value: string) {
    setRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!name.trim() || !preview.tiers) {
      setError(!name.trim() ? 'Nhập tên chính sách.' : preview.error ?? 'Kiểm tra các mốc phí hủy.')
      return
    }
    setBusy(true)
    try {
      const values = { name: name.trim(), description: description.trim() || null, tiers: preview.tiers, isActive: active }
      if (policy) await api.updateCancellationPolicy(policy.id, values)
      else await api.createCancellationPolicy({ hotelId, ...values })
      await onSaved()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const nameField = <FormField label="Tên chính sách">
    <input required maxLength={100} value={name} onChange={event => setName(event.target.value)} />
  </FormField>
  const policyInfo = <div className="grid gap-3">
    <div className="grid gap-3 sm:grid-cols-2">
      {nameField}
      <FormField label="Trạng thái">
        <select value={active ? 'active' : 'inactive'} onChange={event => setActive(event.target.value === 'active')}>
          <option value="active" disabled={!canActivate}>Áp dụng cho đơn đặt phòng mới</option>
          <option value="inactive">Chưa áp dụng</option>
        </select>
      </FormField>
    </div>
    <FormField label="Mô tả thêm"><textarea maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} /></FormField>
  </div>

  const pageSize = 2
  const currentPage = Math.min(tierPage, Math.max(0, Math.ceil(rows.length / pageSize) - 1))
  const firstTier = currentPage * pageSize
  const tierFields = <fieldset className="grid gap-2">
    <legend className="sr-only">Các mốc phí hủy</legend>
    <p className="text-sm text-slate-600">Mốc giờ tính từ lúc đặt phòng. Mỗi mức phí áp dụng đến hết giờ đã nhập.</p>
    {rows.slice(firstTier, firstTier + pageSize).map((row, index) => {
      const tierNumber = firstTier + index + 1
      return <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 sm:gap-3">
        <FormField label={`Hạn cuối mốc ${tierNumber} (giờ)`}><input required type="number" min="0" max="87600" step="1" value={row.hours} onChange={event => updateRow(row.id, 'hours', event.target.value)} /></FormField>
        <FormField label={`Phí hủy mốc ${tierNumber} (%)`}><input required type="number" min="0" max="100" step="0.01" value={row.fee} onChange={event => updateRow(row.id, 'fee', event.target.value)} /></FormField>
        <Button type="button" size="icon" variant="ghost" className="text-red-700" aria-label={`Xóa mốc ${tierNumber}`} onClick={() => {
          setRows(current => current.filter(item => item.id !== row.id))
          setTierPage(Math.min(currentPage, Math.max(0, Math.ceil((rows.length - 1) / pageSize) - 1)))
        }}><Trash2 size={16} aria-hidden="true" /></Button>
      </div>
    })}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => {
        const id = nextId.current++
        setRows(current => [...current, { id, hours: '', fee: '' }])
        setTierPage(Math.floor(rows.length / pageSize))
      }}><Plus size={16} aria-hidden="true" />Thêm mốc</Button>
      <DialogPagination label="Trang mốc phí hủy" page={currentPage} pageSize={pageSize} total={rows.length} onChange={setTierPage} />
    </div>
    <div className="grid grid-cols-2 items-start gap-2 rounded-lg border border-[#DBE8F3] bg-[#F2F7FB] p-2 sm:p-3">
      <FormField label={highestHour === undefined ? rows.length === 0 ? 'Kể từ lúc đặt phòng' : 'Sau mốc cuối' : 'Sau ' + highestHour + ' giờ'}>
        <select value={noCancellationAfterLast ? 'deny' : 'charge'} onChange={event => setNoCancellationAfterLast(event.target.value === 'deny')}>
          <option value="charge">Áp dụng phí hủy</option>
          <option value="deny">Không cho hủy</option>
        </select>
      </FormField>
      {!noCancellationAfterLast && <FormField label="Phí hủy sau mốc cuối (%)"><input required type="number" min="0" max="100" step="0.01" value={tailFee} onChange={event => setTailFee(event.target.value)} /></FormField>}
    </div>
  </fieldset>

  return <DialogContent
    title={policy ? 'Sửa chính sách hủy' : 'Thêm chính sách hủy'}
    description={hotelName}
    layout="workspace"
    className="max-w-4xl"
    footer={<>
      <Button variant="secondary" disabled={busy} onClick={onClose}>Hủy</Button>
      <Button form={formId} type="submit" disabled={busy}>{busy ? 'Đang lưu…' : active ? 'Lưu và áp dụng' : 'Lưu chính sách'}</Button>
    </>}
  >
    <form id={formId} className="grid gap-3" onSubmit={event => void save(event)}>
      <DialogSections label="Chỉnh sửa chính sách hủy" sections={[
        { id: 'info', label: 'Thông tin', content: policyInfo },
        { id: 'tiers', label: 'Mốc phí hủy', content: tierFields },
        { id: 'preview', label: 'Xem trước', content: preview.tiers
          ? <CancellationPolicyTerms tiers={preview.tiers} description={description.trim()} />
          : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{preview.error}</p> },
      ]} />
      <Feedback message={error} kind="error" />
    </form>
  </DialogContent>
}

function PolicyCard({ policy, edit, remove }: { policy: CancellationPolicy; edit: () => void; remove: () => void }) {
  return <Card className="min-w-0 overflow-hidden rounded-2xl">
    <header className={'flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5 ' + (policy.isActive ? 'bg-[#F2F7FB]' : 'bg-slate-50')}>
      <div className="min-w-0">
        {policy.isActive && <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><ShieldCheck size={15} aria-hidden="true" />Chính sách đang áp dụng</p>}
        <h2 className="font-semibold wrap-anywhere text-slate-900">{policy.name}</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={edit}>Chỉnh sửa</Button>
        <Button type="button" size="icon" variant="ghost" className="text-red-700" aria-label={'Xóa ' + policy.name} onClick={remove}><Trash2 size={16} aria-hidden="true" /></Button>
      </div>
    </header>
    <div className="px-4 py-4 sm:px-5">
      <CancellationPolicyTerms {...policy} />
      {policy.isActive && <p className="mt-3 text-sm text-slate-600">Điều khoản này áp dụng cho các đơn đặt phòng mới.</p>}
    </div>
  </Card>
}

export function CancellationPoliciesPage({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const hotels = useQuery({ queryKey: [admin ? 'admin' : 'partner', 'policy-hotels'], queryFn: () => loadHotelOptions(admin) })
  const hotel = hotels.data?.find(item => item.id === params.get('hotelId'))
    ?? (admin ? undefined : hotels.data?.find(item => item.status === 'ACTIVE')) ?? hotels.data?.[0]
  const hotelId = hotel?.id ?? ''
  const canOperate = Boolean(hotelId) && (admin || hotel?.status === 'ACTIVE')
  const { filters, changeFilters, applyFilters } = useSearchFilters(params, setParams, { hotelId })
  const policies = useQuery({ queryKey: ['cancellation-policies', hotelId], queryFn: () => fetchAllPages(page => api.cancellationPolicies(hotelId, page)), enabled: canOperate })
  const activePolicy = policies.data?.find(policy => policy.isActive)
  const inactive = policies.data?.filter(policy => !policy.isActive) ?? []
  const pagination = usePagination(policies.data && inactive.length)
  const [editor, setEditor] = useState<{ hotelId: string; policy: CancellationPolicy | null } | null>(null)
  const [deleting, setDeleting] = useState<CancellationPolicy | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh(id: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cancellation-policies', id] }),
      queryClient.invalidateQueries({ queryKey: ['cancellation-policy-schedule', id] }),
      queryClient.invalidateQueries({ queryKey: ['catalog'] }),
    ])
  }

  async function remove() {
    if (!deleting || !canOperate || deleting.hotelId !== hotelId) return
    setBusy(true)
    setError('')
    try {
      await api.deleteCancellationPolicy(deleting.id)
      await refresh(deleting.hotelId)
      setDeleting(null)
      setNotice('Đã xóa chính sách hủy.')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (hotels.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (!hotel) return <EmptyState title="Chưa có khách sạn" description="Tạo hồ sơ khách sạn trước khi thiết lập chính sách hủy." />

  const addPolicy = () => setEditor({ hotelId, policy: null })
  const policyCard = (policy: CancellationPolicy) => <PolicyCard key={policy.id} policy={policy}
    edit={() => setEditor({ hotelId, policy })}
    remove={() => { setDeleting(policy); setError('') }} />

  return <div className="management-list">
    <PageHeader title="Chính sách hủy" description="Thiết lập mức phí theo thời gian tính từ lúc đặt phòng." actions={canOperate && activePolicy && <Button onClick={addPolicy}><Plus size={16} aria-hidden="true" />Thêm chính sách</Button>} />
    <form onSubmit={event => { applyFilters(event); setNotice('') }} aria-label="Tìm kiếm chính sách hủy" className="management-filters grid max-w-lg grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-xl border border-slate-200 bg-white">
      <FormField label="Khách sạn"><select value={filters.hotelId} onChange={event => changeFilters({ hotelId: event.target.value })}>{hotels.data.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField>
      <SearchButton />
    </form>

    {!canOperate ? <HotelManagementLocked hotel={hotel} /> : <>
    <Feedback message={notice} />
    {policies.isPending ? <LoadingState /> : policies.isError
      ? <ErrorState message={errorMessage(policies.error)} retry={() => { void policies.refetch() }} />
      : <div className="management-results grid gap-3">
        {activePolicy ? policyCard(activePolicy) : <Card className="rounded-2xl p-5">
          <EmptyState
            title={inactive.length ? 'Chưa có chính sách đang áp dụng' : 'Khách sạn chưa có chính sách hủy'}
            description={inactive.length ? 'Áp dụng một chính sách để tiếp tục nhận đơn đặt phòng mới.' : 'Thêm điều khoản hủy để khách sạn có thể nhận đơn đặt phòng mới.'}
            action={<Button onClick={addPolicy}><Plus size={16} aria-hidden="true" />{inactive.length ? 'Thêm chính sách' : 'Thêm chính sách đầu tiên'}</Button>}
          />
        </Card>}
        {inactive.length > 0 && <section aria-labelledby="inactive-policies" className="grid gap-3">
          <h2 id="inactive-policies" className="font-semibold text-slate-900">Chính sách chưa áp dụng</h2>
          {pageItems(inactive, pagination.page, pagination.size).map(policyCard)}
        </section>}
      </div>}
    {inactive.length > Math.min(PAGE_SIZE, pagination.size) && <Pagination page={pagination.page} total={inactive.length} onPageChange={pagination.setPage} size={pagination.size} onSizeChange={pagination.setSize} />}

    <Dialog open={editor?.hotelId === hotelId} onOpenChange={open => { if (!open) setEditor(null) }}>
      {editor?.hotelId === hotelId && <PolicyEditor policy={editor.policy} hotelId={editor.hotelId} hotelName={hotel.name} canActivate={!activePolicy || editor.policy?.id === activePolicy.id}
          onClose={() => setEditor(null)} onSaved={async () => { await refresh(editor.hotelId); setEditor(null); setNotice('Đã lưu chính sách hủy.') }} />}
    </Dialog>

    <Dialog open={deleting?.hotelId === hotelId} onOpenChange={open => { if (!open && !busy) setDeleting(null) }}>
      <DialogContent title="Xóa chính sách hủy?" description={deleting?.name}>
        <p className="text-sm text-slate-600">{deleting?.isActive ? 'Khách sạn cần áp dụng chính sách khác để nhận đơn đặt phòng mới. ' : ''}Đơn đã đặt dùng điều khoản đã lưu lúc đặt.</p>
        <Feedback message={error} kind="error" />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Giữ lại</Button>
          <Button variant="danger" disabled={busy} onClick={() => { void remove() }}><Trash2 size={16} aria-hidden="true" />{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>}
  </div>
}
