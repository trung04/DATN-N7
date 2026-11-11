import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { api } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'
import type { CancellationPolicy, PartnerHotelQuery } from '@/types/domain'

const hotelsQuery: PartnerHotelQuery = { page: 1, limit: 100, sortBy: 'name', sortOrder: 'ASC' }
const moneyRate = (value: number | null) => `${value ?? 0}%`
const rangeLabel = (policy: CancellationPolicy) => policy.maxHoursBeforeCheckIn === null
  ? `Từ ${policy.minHoursBeforeCheckIn} giờ trước giờ nhận phòng trở lên`
  : `${policy.minHoursBeforeCheckIn} đến dưới ${policy.maxHoursBeforeCheckIn} giờ trước giờ nhận phòng`

export function CancellationPoliciesPage({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const hotels = useQuery({ queryKey: [admin ? 'admin' : 'partner', 'policy-hotels'], queryFn: () => admin ? api.adminHotels(hotelsQuery) : api.myHotels(hotelsQuery) })
  const selectedHotelId = params.get('hotelId') || hotels.data?.data[0]?.id || ''
  const policies = useQuery({ queryKey: ['cancellation-policies', selectedHotelId], queryFn: () => api.cancellationPolicies(selectedHotelId), enabled: Boolean(selectedHotelId) })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CancellationPolicy | null>(null)
  const [deleting, setDeleting] = useState<CancellationPolicy | null>(null)
  const [name, setName] = useState('')
  const [minHours, setMinHours] = useState('0')
  const [maxHours, setMaxHours] = useState('')
  const [fee, setFee] = useState('0')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const selectHotel = (id: string) => { const next = new URLSearchParams(params); if (id) next.set('hotelId', id); else next.delete('hotelId'); setParams(next, { replace: true }) }
  const openCreate = () => { setEditing(null); setName(''); setMinHours('0'); setMaxHours(''); setFee('0'); setDescription(''); setError(''); setDialogOpen(true) }
  const openEdit = (policy: CancellationPolicy) => { setEditing(policy); setName(policy.name); setMinHours(String(policy.minHoursBeforeCheckIn)); setMaxHours(policy.maxHoursBeforeCheckIn === null ? '' : String(policy.maxHoursBeforeCheckIn)); setFee(String(policy.cancellationFeeRate ?? 0)); setDescription(policy.description ?? ''); setError(''); setDialogOpen(true) }
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['cancellation-policies', selectedHotelId] }); await queryClient.invalidateQueries({ queryKey: ['catalog'] }) }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    const min = Number(minHours); const max = maxHours.trim() ? Number(maxHours) : null
    if (!Number.isInteger(min) || min < 0 || (max !== null && (!Number.isInteger(max) || max <= min))) { setError('Khoảng giờ không hợp lệ. Giờ kết thúc phải lớn hơn giờ bắt đầu.'); return }
    setBusy(true)
    try {
      const input = { hotelId: selectedHotelId, name: name.trim(), minHoursBeforeCheckIn: min, maxHoursBeforeCheckIn: max, cancellationFeeRate: Number(fee), description: description.trim() || null }
      if (editing) { const { hotelId: _hotelId, ...update } = input; await api.updateCancellationPolicy(editing.id, update) }
      else await api.createCancellationPolicy(input)
      await refresh(); setDialogOpen(false); setNotice(editing ? 'Đã cập nhật chính sách hủy.' : 'Đã thêm chính sách hủy.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const remove = async () => { if (!deleting) return; setBusy(true); setError(''); try { await api.deleteCancellationPolicy(deleting.id); await refresh(); setDeleting(null); setNotice('Đã xóa chính sách hủy.') } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) } }

  if (hotels.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (!hotels.data.data.length) return <EmptyState title="Chưa có khách sạn" description="Tạo hồ sơ khách sạn trước khi thiết lập chính sách hủy." />
  if (policies.isPending) return <LoadingState />
  if (policies.isError) return <ErrorState message={errorMessage(policies.error)} retry={() => { void policies.refetch() }} />
  const hotelName = hotels.data.data.find(item => item.id === selectedHotelId)?.name
  return <div>
    <PageHeader title="Chính sách hủy" description="Chính sách được áp dụng theo số giờ còn lại đến giờ nhận phòng. Các khoảng giờ của cùng khách sạn không được chồng lấn." actions={<Button onClick={openCreate}><Plus size={16} />Thêm chính sách</Button>} />
    <div className="mb-4 max-w-lg"><FormField label="Khách sạn"><select value={selectedHotelId} onChange={event => selectHotel(event.target.value)}>{hotels.data.data.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField></div>
    <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">Khi khách hủy booking tại {hotelName}, hệ thống chọn chính sách có khoảng giờ khớp với thời điểm hủy và ghi chính sách cùng phí vào booking.</p>
    <Feedback message={notice} />
    {policies.data.data.length ? <Card className="mt-4 table-scroll"><table><thead><tr><th>Tên chính sách</th><th>Điều kiện áp dụng</th><th>Phí hủy</th><th>Mô tả</th><th>Thao tác</th></tr></thead><tbody>{policies.data.data.map(policy => <tr key={policy.id}><td className="font-semibold">{policy.name}</td><td>{rangeLabel(policy)}</td><td>{moneyRate(policy.cancellationFeeRate)}</td><td className="max-w-sm whitespace-normal">{policy.description || '—'}</td><td><div className="flex gap-3"><button className="font-semibold text-[#1E3A5F]" onClick={() => openEdit(policy)}>Chỉnh sửa</button><button className="text-red-700" aria-label={`Xóa ${policy.name}`} onClick={() => { setDeleting(policy); setError('') }}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></Card> : <EmptyState title="Chưa có chính sách hủy" description="Thêm các khoảng giờ và mức phí để hệ thống biết quy tắc cần áp dụng khi khách hủy." action={<Button onClick={openCreate}><Plus size={16} />Thêm chính sách</Button>} />}
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent title={editing ? 'Sửa chính sách hủy' : 'Thêm chính sách hủy'}><form className="grid gap-4" onSubmit={save}>
      <FormField label="Tên chính sách"><input required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></FormField>
      <div className="grid gap-4 sm:grid-cols-2"><FormField label="Từ (giờ trước nhận phòng)" hint="Tính cả mốc này"><input required type="number" min="0" max="87600" value={minHours} onChange={event => setMinHours(event.target.value)} /></FormField><FormField label="Đến dưới (giờ)" hint="Để trống nếu không có giới hạn trên"><input type="number" min="1" max="87600" value={maxHours} onChange={event => setMaxHours(event.target.value)} /></FormField></div>
      <FormField label="Phí hủy (%)"><input required type="number" min="0" max="100" step="0.01" value={fee} onChange={event => setFee(event.target.value)} /></FormField>
      <FormField label="Mô tả"><textarea maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} /></FormField>
      <p className="text-xs text-slate-500">Ví dụ: 24 đến dưới 48 giờ tương ứng với khoảng [24, 48). Không có chính sách nào tự động được coi là mặc định.</p>
      <Feedback message={error} kind="error" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Hủy</Button><Button disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu chính sách'}</Button></div>
    </form></DialogContent></Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null) }}><DialogContent title="Xóa chính sách hủy?" description={deleting?.name}><p className="text-sm text-slate-600">Booking đã hủy vẫn giữ bản chụp chính sách và mức phí đã áp dụng.</p><Feedback message={error} kind="error" /><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Giữ lại</Button><Button variant="danger" disabled={busy} onClick={() => { void remove() }}><Trash2 size={16} />{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</Button></div></DialogContent></Dialog>
  </div>
}
