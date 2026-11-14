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

const cancellationText = (policy: Pick<CancellationPolicy, 'cancelHours' | 'penaltyPercent' | 'cancellationAllowed' | 'description'>) => {
  if (!policy.cancellationAllowed) return `Không hỗ trợ hủy. ${policy.description ?? ''}`.trim()
  return `Miễn phí trong ${policy.cancelHours} giờ đầu sau khi đặt; sau đó phí hủy ${policy.penaltyPercent}%.`
}

export function CancellationPoliciesPage({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const hotels = useQuery({ queryKey: [admin ? 'admin' : 'partner', 'policy-hotels'], queryFn: () => admin ? api.adminHotels(hotelsQuery) : api.myHotels(hotelsQuery) })
  const selectedHotelId = params.get('hotelId') || hotels.data?.data[0]?.id || ''
  const policies = useQuery({ queryKey: ['cancellation-policies', selectedHotelId], queryFn: () => api.cancellationPolicies(selectedHotelId), enabled: Boolean(selectedHotelId) })
  const schedule = useQuery({ queryKey: ['cancellation-policy-schedule', selectedHotelId], queryFn: () => api.cancellationPolicySchedule(selectedHotelId), enabled: Boolean(selectedHotelId) })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CancellationPolicy | null>(null)
  const [deleting, setDeleting] = useState<CancellationPolicy | null>(null)
  const [name, setName] = useState('')
  const [cancelHours, setCancelHours] = useState('24')
  const [penaltyPercent, setPenaltyPercent] = useState('50')
  const [cancellationAllowed, setCancellationAllowed] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const selectHotel = (id: string) => { const next = new URLSearchParams(params); if (id) next.set('hotelId', id); else next.delete('hotelId'); setParams(next, { replace: true }) }
  const openCreate = () => { setEditing(null); setName(''); setCancelHours('24'); setPenaltyPercent('50'); setCancellationAllowed(true); setIsActive(true); setDescription(''); setError(''); setDialogOpen(true) }
  const openEdit = (policy: CancellationPolicy) => { setEditing(policy); setName(policy.name); setCancelHours(String(policy.cancelHours)); setPenaltyPercent(String(policy.penaltyPercent)); setCancellationAllowed(policy.cancellationAllowed); setIsActive(policy.isActive); setDescription(policy.description ?? ''); setError(''); setDialogOpen(true) }
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['cancellation-policies', selectedHotelId] }); await queryClient.invalidateQueries({ queryKey: ['cancellation-policy-schedule', selectedHotelId] }); await queryClient.invalidateQueries({ queryKey: ['catalog'] }) }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    const hours = Number(cancelHours); const penalty = Number(penaltyPercent)
    if (!Number.isInteger(hours) || hours < 0 || hours > 87600) { setError('Số giờ miễn phí phải là số nguyên từ 0 đến 87.600.'); return }
    if (cancellationAllowed && (!Number.isFinite(penalty) || penalty < 0 || penalty > 100)) { setError('Phí hủy phải nằm trong khoảng 0% đến 100%.'); return }
    if (!cancellationAllowed && description.trim().length < 5) { setError('Nếu không cho hủy, hãy ghi rõ điều này trong mô tả.'); return }
    setBusy(true)
    try {
      const input = { hotelId: selectedHotelId, name: name.trim(), cancelHours: hours, penaltyPercent: cancellationAllowed ? penalty : 0, cancellationAllowed, isActive, description: description.trim() || null }
      if (editing) { const { hotelId: _hotelId, ...update } = input; await api.updateCancellationPolicy(editing.id, update) }
      else await api.createCancellationPolicy(input)
      await refresh(); setDialogOpen(false); setNotice('Đã lưu chính sách hủy.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const remove = async () => { if (!deleting) return; setBusy(true); setError(''); try { await api.deleteCancellationPolicy(deleting.id); await refresh(); setDeleting(null); setNotice('Đã xóa chính sách hủy.') } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) } }

  if (hotels.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (!hotels.data.data.length) return <EmptyState title="Chưa có khách sạn" description="Tạo hồ sơ khách sạn trước khi thiết lập chính sách hủy." />
  if (policies.isPending || schedule.isPending) return <LoadingState />
  if (policies.isError) return <ErrorState message={errorMessage(policies.error)} retry={() => { void policies.refetch() }} />
  if (schedule.isError) return <ErrorState message={errorMessage(schedule.error)} retry={() => { void schedule.refetch() }} />

  const activePolicy = policies.data.data.find(policy => policy.isActive)
  return <div>
    <PageHeader title="Chính sách hủy" description="Mỗi khách sạn có một chính sách đang áp dụng. Mốc miễn phí được tính từ lúc khách đặt booking." actions={!activePolicy && <Button onClick={openCreate}><Plus size={16} />Thêm chính sách</Button>} />
    <div className="mb-4 max-w-lg"><FormField label="Khách sạn"><select value={selectedHotelId} onChange={event => selectHotel(event.target.value)}>{hotels.data.data.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField></div>
    <p className={'mb-4 rounded-lg border p-3 text-sm ' + (schedule.data.complete ? 'border-emerald-100 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950')}>
      {schedule.data.complete ? 'Chính sách đang hoạt động sẽ được lưu cùng booking mới.' : `Chưa thể nhận booking: ${schedule.data.issue}`}
    </p>
    <Feedback message={notice} />
    {policies.data.data.length ? <Card className="mt-4 table-scroll"><table><thead><tr><th>Tên chính sách</th><th>Điều khoản</th><th>Trạng thái</th><th>Mô tả</th><th>Thao tác</th></tr></thead><tbody>{policies.data.data.map(policy => <tr key={policy.id}><td className="font-semibold">{policy.name}</td><td>{cancellationText(policy)}</td><td>{policy.isActive ? 'Đang áp dụng' : 'Đã tắt'}</td><td className="max-w-sm whitespace-normal">{policy.description || '—'}</td><td><div className="flex gap-3"><button className="font-semibold text-[#1E3A5F]" onClick={() => openEdit(policy)}>Chỉnh sửa</button><button className="text-red-700" aria-label={`Xóa ${policy.name}`} onClick={() => { setDeleting(policy); setError('') }}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></Card> : <EmptyState title="Chưa có chính sách hủy" description="Tạo chính sách để khách biết rõ quyền hủy và mức phí trước khi đặt." action={<Button onClick={openCreate}><Plus size={16} />Thêm chính sách</Button>} />}
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent title={editing ? 'Sửa chính sách hủy' : 'Thêm chính sách hủy'}><form className="grid gap-4" onSubmit={save}>
      <FormField label="Tên chính sách"><input required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></FormField>
      <FormField label="Số giờ được hủy miễn phí kể từ lúc đặt"><input required type="number" min="0" max="87600" value={cancelHours} onChange={event => setCancelHours(event.target.value)} /><span className="text-xs text-slate-500">Sau thời gian này, mức phí bên dưới được áp dụng.</span></FormField>
      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={!cancellationAllowed} onChange={event => setCancellationAllowed(!event.target.checked)} /><span>Khách sạn không cho phép hủy booking</span></label>
      {cancellationAllowed ? <FormField label="Phí hủy sau thời gian miễn phí (%)"><input required type="number" min="0" max="100" step="0.01" value={penaltyPercent} onChange={event => setPenaltyPercent(event.target.value)} /></FormField> : <p className="text-sm text-amber-900">Khách sẽ không thể hủy booking. Hãy ghi rõ điều khoản này trong mô tả.</p>}
      <FormField label={cancellationAllowed ? 'Mô tả thêm' : 'Điều khoản không cho hủy'}><textarea required={!cancellationAllowed} minLength={cancellationAllowed ? undefined : 5} maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} /></FormField>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} />Đang áp dụng cho booking mới</label>
      <Feedback message={error} kind="error" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Đóng</Button><Button disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu chính sách'}</Button></div>
    </form></DialogContent></Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null) }}><DialogContent title="Xóa chính sách hủy?" description={deleting?.name}><p className="text-sm text-slate-600">Booking đã tạo vẫn giữ nguyên bản chụp điều khoản.</p><Feedback message={error} kind="error" /><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Giữ lại</Button><Button variant="danger" disabled={busy} onClick={() => { void remove() }}><Trash2 size={16} />{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</Button></div></DialogContent></Dialog>
  </div>
}
