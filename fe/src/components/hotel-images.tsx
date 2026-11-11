import { useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, Upload } from 'lucide-react'
import { Card, Feedback, FormField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { api, apiAssetUrl } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'
import type { PartnerHotel } from '@/types/domain'

export function HotelImages({ hotel }: { hotel: PartnerHotel }) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const locked = hotel.status === 'PENDING_APPROVAL'
  const images = hotel.images ?? []

  const refresh = () => queryClient.invalidateQueries({ predicate: query =>
    ['partner-hotel', 'partner-hotels', 'admin-hotel', 'admin-hotels', 'catalog'].includes(String(query.queryKey[0])),
  })
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(''); setMessage('')
    if (!file) { setError('Vui lòng chọn ảnh.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Chỉ nhận ảnh JPEG, PNG hoặc WebP.'); return }
    if (!file.size || file.size > 5 * 1024 * 1024) { setError('Ảnh phải có dung lượng từ 1 byte đến 5 MiB.'); return }
    setBusy(true)
    try {
      await api.uploadHotelImage(hotel.id, file)
      setFile(null)
      if (input.current) input.current.value = ''
      setMessage('Đã tải ảnh lên.')
      await refresh()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!deleteId) return
    setBusy(true); setError(''); setMessage('')
    try {
      await api.deleteHotelImage(hotel.id, deleteId)
      setDeleteId(null); setMessage('Đã xóa ảnh.')
      await refresh()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  return <Card className="p-6">
    <h2 className="text-lg font-semibold">Ảnh khách sạn</h2>
    <p className="mt-2 text-sm text-slate-500">JPEG, PNG hoặc WebP, tối đa 5 MiB mỗi ảnh.</p>
    {images.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((image, index) => <figure key={image.id} className="overflow-hidden rounded-lg border border-slate-200">
      <a href={apiAssetUrl(image.previewUrl)} target="_blank" rel="noreferrer"><img src={apiAssetUrl(image.previewUrl)} alt={`${hotel.name} — ảnh ${index + 1}`} className="aspect-video w-full object-cover" loading="lazy" /></a>
      <figcaption className="flex items-center justify-between gap-2 p-3"><span className="text-xs text-slate-500">{image.width} × {image.height}</span><Button type="button" size="sm" variant="danger" disabled={locked || busy} aria-label={`Xóa ảnh ${index + 1}`} onClick={() => { setError(''); setDeleteId(image.id) }}><Trash2 size={15} />Xóa</Button></figcaption>
    </figure>)}</div> : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có ảnh khách sạn.</p>}
    {locked ? <p className="mt-4 text-sm text-amber-800">Ảnh tạm khóa trong khi hồ sơ chờ duyệt.</p> : <form className="mt-5 grid gap-3 border-t border-slate-200 pt-5" onSubmit={upload}>
      <FormField label="Chọn ảnh khách sạn"><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setError(''); setMessage('') }} /></FormField>
      <Button className="w-fit" disabled={!file || busy}><Upload size={16} />{busy ? 'Đang xử lý…' : 'Tải ảnh lên'}</Button>
    </form>}
    <div className="mt-3" aria-live="polite"><Feedback message={error} kind="error" /><Feedback message={message} /></div>
    <Dialog open={Boolean(deleteId)} onOpenChange={open => { if (!open && !busy) setDeleteId(null) }}><DialogContent title="Xóa ảnh khách sạn?" description="Ảnh sẽ được xóa khỏi khách sạn và kho lưu trữ.">
      <Feedback message={error} kind="error" />
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleteId(null)}>Hủy</Button><Button type="button" variant="danger" disabled={busy || locked} onClick={() => { void remove() }}>{busy ? 'Đang xóa…' : 'Xóa ảnh'}</Button></div>
    </DialogContent></Dialog>
  </Card>
}
