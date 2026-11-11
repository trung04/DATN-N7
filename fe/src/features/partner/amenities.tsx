import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { api } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'
import type { AmenityOption, PartnerHotelQuery } from '@/types/domain'

const hotelQuery: PartnerHotelQuery = { page: 1, limit: 100, sortBy: 'name', sortOrder: 'ASC' }

export function PartnerAmenitiesPage() {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const hotels = useQuery({ queryKey: ['partner-hotels', 'amenity-manager'], queryFn: () => api.myHotels(hotelQuery) })
  const selectedHotelId = params.get('hotelId') || hotels.data?.data[0]?.id || ''
  const amenities = useQuery({ queryKey: ['partner-hotel-amenities', selectedHotelId], queryFn: () => api.hotelAmenities(selectedHotelId), enabled: Boolean(selectedHotelId) })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AmenityOption | null>(null)
  const [deleting, setDeleting] = useState<AmenityOption | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const hotel = hotels.data?.data.find(item => item.id === selectedHotelId)
  const selectHotel = (id: string) => { const next = new URLSearchParams(params); if (id) next.set('hotelId', id); else next.delete('hotelId'); setParams(next, { replace: true }) }
  const openCreate = () => { setEditing(null); setCode(''); setName(''); setError(''); setFormOpen(true) }
  const openEdit = (item: AmenityOption) => { setEditing(item); setCode(item.code); setName(item.name); setError(''); setFormOpen(true) }
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['partner-hotel-amenities', selectedHotelId] })
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selectedHotelId) return
    setBusy(true); setError('')
    try {
      if (editing) await api.updateHotelAmenity(selectedHotelId, editing.id, { code: code.trim().toUpperCase(), name: name.trim() })
      else await api.createHotelAmenity(selectedHotelId, { code: code.trim().toUpperCase(), name: name.trim() })
      await refresh(); setFormOpen(false); setEditing(null); setNotice(editing ? 'Đã cập nhật tiện nghi.' : 'Đã thêm tiện nghi cho khách sạn.')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!deleting) return
    setBusy(true); setError('')
    try { await api.deleteHotelAmenity(selectedHotelId, deleting.id); await refresh(); setDeleting(null); setNotice('Đã xóa tiện nghi khỏi khách sạn.') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  if (hotels.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (!hotels.data.data.length) return <EmptyState title="Chưa có khách sạn" description="Tạo hồ sơ khách sạn trước khi thêm tiện nghi riêng." />
  if (amenities.isPending) return <LoadingState />
  if (amenities.isError) return <ErrorState message={errorMessage(amenities.error)} retry={() => { void amenities.refetch() }} />
  return <div>
    <PageHeader title="Tiện nghi khách sạn" description="Tạo tiện nghi riêng cho khách sạn đang chọn. Các tiện nghi này chỉ xuất hiện trong khách sạn của bạn." actions={<Button onClick={openCreate}><Plus size={16} />Thêm tiện nghi</Button>} />
    <div className="mb-4 max-w-lg"><FormField label="Khách sạn"><select value={selectedHotelId} onChange={event => selectHotel(event.target.value)}>{hotels.data.data.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField></div>
    <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">Tiện nghi chung của hệ thống vẫn có sẵn trong form phòng. Tiện nghi bạn tạo ở đây được giới hạn trong “{hotel?.name}” và có thể gắn vào phòng của khách sạn này.</p>
    <Feedback message={notice} />
    {amenities.data.data.length ? <Card className="mt-4 table-scroll"><table><thead><tr><th>Mã</th><th>Tên tiện nghi</th><th>Thao tác</th></tr></thead><tbody>{amenities.data.data.map(item => <tr key={item.id}><td className="font-mono text-sm">{item.code}</td><td className="font-semibold">{item.name}</td><td><div className="flex gap-3"><button className="font-semibold text-[#1E3A5F]" onClick={() => openEdit(item)}>Chỉnh sửa</button><button className="text-red-700" aria-label={`Xóa ${item.name}`} onClick={() => { setDeleting(item); setError('') }}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></Card> : <EmptyState title="Khách sạn chưa có tiện nghi riêng" description="Thêm các tiện nghi đặc thù của khách sạn; tiện nghi chung vẫn được chọn trong form phòng." action={<Button onClick={openCreate}><Plus size={16} />Thêm tiện nghi</Button>} />}
    <Dialog open={formOpen} onOpenChange={open => { setFormOpen(open); if (!open) setEditing(null) }}><DialogContent title={editing ? 'Sửa tiện nghi khách sạn' : 'Thêm tiện nghi khách sạn'}><form className="grid gap-4" onSubmit={save}>
      <FormField label="Mã tiện nghi" hint="Chỉ dùng chữ, số và dấu gạch dưới; mã chỉ cần duy nhất trong khách sạn này."><input required maxLength={50} pattern="[A-Za-z0-9]+(_[A-Za-z0-9]+)*" value={code} onChange={event => setCode(event.target.value)} /></FormField>
      <FormField label="Tên hiển thị"><input required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></FormField>
      <Feedback message={error} kind="error" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => { setFormOpen(false); setEditing(null) }}>Hủy</Button><Button disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu tiện nghi'}</Button></div>
    </form></DialogContent></Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null) }}><DialogContent title="Xóa tiện nghi?" description={deleting?.name}><p className="text-sm text-slate-600">Nếu tiện nghi đang được gắn vào phòng, backend có thể từ chối thao tác xóa.</p><Feedback message={error} kind="error" /><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Hủy</Button><Button variant="danger" disabled={busy} onClick={() => { void remove() }}><Trash2 size={16} />{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</Button></div></DialogContent></Dialog>
  </div>
}
