import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { api } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'
import type { AmenityOption } from '@/types/domain'

export function AdminAmenitiesPage() {
  const queryClient = useQueryClient()
  const amenities = useQuery({ queryKey: ['admin-amenities'], queryFn: api.amenities })
  const [editing, setEditing] = useState<AmenityOption | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<AmenityOption | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const openNew = () => { setEditing(null); setCode(''); setName(''); setError(''); setFormOpen(true) }
  const openEdit = (item: AmenityOption) => { setEditing(item); setCode(item.code); setName(item.name); setError(''); setFormOpen(true) }
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-amenities'] })
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (editing) await api.updateAmenity(editing.id, { code: code.trim(), name: name.trim() })
      else await api.createAmenity({ code: code.trim().toUpperCase(), name: name.trim() })
      await refresh(); setFormOpen(false); setEditing(null); setNotice(editing ? 'Đã cập nhật tiện nghi.' : 'Đã tạo tiện nghi.')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!deleting) return
    setBusy(true); setError('')
    try { await api.deleteAmenity(deleting.id); await refresh(); setDeleting(null); setNotice('Đã xóa tiện nghi.') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  if (amenities.isPending) return <LoadingState />
  if (amenities.isError) return <ErrorState message={errorMessage(amenities.error)} retry={() => { void amenities.refetch() }} />
  return <div>
    <PageHeader title="Tiện nghi" description="Quản lý danh mục tiện nghi được gắn vào phòng khách sạn." actions={<Button onClick={openNew}><Plus size={16} />Thêm tiện nghi</Button>} />
    <Feedback message={notice} />
    {amenities.data.data.length ? <Card className="mt-4 table-scroll"><table><thead><tr><th>Mã</th><th>Tên tiện nghi</th><th>Thao tác</th></tr></thead><tbody>{amenities.data.data.map(item => <tr key={item.id}><td className="font-mono text-sm">{item.code}</td><td className="font-semibold">{item.name}</td><td><div className="flex gap-3"><button className="font-semibold text-[#1E3A5F]" onClick={() => openEdit(item)}>Chỉnh sửa</button><button className="text-red-700" aria-label={`Xóa ${item.name}`} onClick={() => { setDeleting(item); setError('') }}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></Card> : <EmptyState title="Chưa có tiện nghi" action={<Button onClick={openNew}><Plus size={16} />Thêm tiện nghi</Button>} />}
    <Dialog open={formOpen} onOpenChange={open => { setFormOpen(open); if (!open) setEditing(null) }}>
      <DialogContent title={editing ? 'Cập nhật tiện nghi' : 'Thêm tiện nghi'}><form className="grid gap-4" onSubmit={save}>
        <FormField label="Mã tiện nghi" hint="Chỉ dùng chữ, số và dấu gạch dưới; ví dụ WIFI"><input required maxLength={50} pattern="[A-Za-z0-9]+(_[A-Za-z0-9]+)*" value={code} onChange={event => setCode(event.target.value)} /></FormField>
        <FormField label="Tên hiển thị"><input required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></FormField>
        <Feedback message={error} kind="error" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => { setFormOpen(false); setEditing(null) }}>Hủy</Button><Button disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu tiện nghi'}</Button></div>
      </form></DialogContent>
    </Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null) }}><DialogContent title="Xóa tiện nghi?" description={deleting?.name}><Feedback message={error} kind="error" /><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Hủy</Button><Button variant="danger" disabled={busy} onClick={() => { void remove() }}><Trash2 size={16} />{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</Button></div></DialogContent></Dialog>
  </div>
}
