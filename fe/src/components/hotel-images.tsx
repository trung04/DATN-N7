import { PaginatedList } from '@/components/paginated-list'
import { useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, Upload } from 'lucide-react'
import { Card, Feedback } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DialogList } from '@/components/ui/dialog-sections'
import { api, apiAssetUrl } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'
import type { PartnerHotel } from '@/types/domain'

export function HotelImages({ hotel, compact = false, onBusyChange }: { hotel: PartnerHotel; compact?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setLocalBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const locked = hotel.status === 'PENDING_APPROVAL'
  const images = hotel.images ?? []
  const setBusy = (value: boolean) => { setLocalBusy(value); onBusyChange?.(value) }

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
  const primary = async (imageId: string) => {
    setBusy(true); setError(''); setMessage('')
    try { await api.primaryHotelImage(hotel.id, imageId); await refresh(); setMessage('Đã chọn ảnh đại diện.') }
    catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
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

  const uploadForm = locked ? <p className="text-sm text-amber-800">Ảnh tạm khóa trong khi hồ sơ chờ duyệt.</p> : <form className={compact ? 'flex flex-wrap items-center gap-2' : 'mt-5 grid gap-3 border-t border-slate-200 pt-5'} onSubmit={upload}>
    <label className="inline-flex min-h-9 min-w-0 w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-medium text-[#1E3A5F] focus-within:ring-2">
      <span className="max-w-36 truncate">{file?.name ?? 'Chọn ảnh khách sạn'}</span>
      <input ref={input} aria-label="Chọn ảnh khách sạn" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setError(''); setMessage('') }} />
    </label>
    <Button className="w-fit" size={compact ? 'sm' : 'default'} disabled={!file || busy}><Upload size={15} />{busy ? 'Đang xử lý…' : 'Tải ảnh lên'}</Button>
  </form>

  return <Card className={compact ? 'grid min-w-0 gap-2.5 p-3 sm:p-4' : 'p-6'}>
    <h2 className="text-lg font-semibold">Ảnh khách sạn</h2>
    <p className={compact ? 'text-xs text-slate-600' : 'mt-2 text-sm text-slate-500'}>JPEG, PNG hoặc WebP, tối đa 5 MiB mỗi ảnh.</p>
    {compact ? <>
      {images.length ? <DialogList label="Phân trang ảnh khách sạn" pageSize={1} items={images.map((image, index) => <li key={image.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <a className="self-start" href={apiAssetUrl(image.previewUrl)} target="_blank" rel="noreferrer"><img src={apiAssetUrl(image.previewUrl)} alt={`${hotel.name} — ảnh ${index + 1}`} className="h-16 w-full rounded-md bg-slate-100 object-cover sm:h-20" loading="lazy" /></a>
        <div className="grid content-center justify-items-start gap-1">
          {index === 0 ? <span className="text-xs font-semibold text-[#1E3A5F]">Ảnh đại diện</span> : <button type="button" className="text-left text-xs font-medium text-[#1E3A5F] underline disabled:opacity-50" disabled={locked || busy} onClick={() => { void primary(image.id) }}>Đặt làm ảnh đại diện</button>}
          <Button type="button" size="sm" variant="ghost" disabled={locked || busy} aria-label={`Xóa ảnh ${index + 1}`} onClick={() => { setError(''); setDeleteId(image.id) }}><Trash2 size={14} />Xóa ảnh</Button>
        </div>
      </li>)} /> : <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Thêm ít nhất một ảnh khách sạn.</p>}
    </> : images.length ? <PaginatedList key={hotel.id} items={images} label="Phân trang ảnh khách sạn">{(visible, offset) => <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((image, localIndex) => {
      const index = offset + localIndex
      return <figure key={image.id} className="overflow-hidden rounded-lg border border-slate-200">
      <a href={apiAssetUrl(image.previewUrl)} target="_blank" rel="noreferrer"><img src={apiAssetUrl(image.previewUrl)} alt={`${hotel.name} — ảnh ${index + 1}`} className="aspect-video w-full object-cover" loading="lazy" /></a>
      <figcaption className="flex items-center justify-between gap-2 p-3"><span className="text-xs text-slate-500">{image.width != null && image.height != null ? `${image.width} × ${image.height}` : 'Ảnh khách sạn'}</span><Button type="button" size="sm" variant="danger" disabled={locked || busy} aria-label={`Xóa ảnh ${index + 1}`} onClick={() => { setError(''); setDeleteId(image.id) }}><Trash2 size={15} />Xóa</Button>{index === 0 ? <span className="text-xs">Ảnh đại diện</span> : <Button type="button" size="sm" variant="secondary" disabled={locked || busy} onClick={() => { void primary(image.id) }}>Đặt làm ảnh đại diện</Button>}</figcaption>
    </figure>
    })}</div>}</PaginatedList> : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có ảnh khách sạn.</p>}
    {uploadForm}
    {(error || message) && <div aria-live="polite"><Feedback message={error} kind="error" /><Feedback message={message} /></div>}
    <Dialog open={Boolean(deleteId)} onOpenChange={open => { if (!open && !busy) setDeleteId(null) }}><DialogContent title="Xóa ảnh khách sạn?" description="Ảnh sẽ được gỡ khỏi khách sạn.">
      <Feedback message={error} kind="error" />
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleteId(null)}>Hủy</Button><Button type="button" variant="danger" disabled={busy || locked} onClick={() => { void remove() }}>{busy ? 'Đang xóa…' : 'Xóa ảnh'}</Button></div>
    </DialogContent></Dialog>
  </Card>
}
