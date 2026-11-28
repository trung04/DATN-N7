import { Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorState, Feedback, LoadingState, Picture } from './common'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { DialogList } from './ui/dialog-sections'
import { api, apiAssetUrl } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'

export function RoomImages({ roomId, locked }: { roomId: string; locked: boolean }) {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['room-images', roomId, 'managed'], queryFn: () => api.roomImages(roomId, true) })
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const run = async (action: () => Promise<unknown>, success: string) => {
    if (busy || locked) return
    setBusy(true); setError(''); setMessage('')
    try {
      await action(); setMessage(success); setDeleteId(null)
      await client.invalidateQueries({ predicate: q => ['room-images', 'partner-managed-room', 'partner-managed-rooms', 'catalog'].includes(String(q.queryKey[0])) })
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const upload = () => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
      setError('Chọn ảnh JPEG, PNG hoặc WebP, tối đa 5 MiB.'); return
    }
    void run(async () => {
      await api.uploadRoomImage(roomId, file)
      setFile(undefined)
      if (input.current) input.current.value = ''
    }, 'Đã tải ảnh phòng lên.')
  }
  return <div className="grid min-w-0 gap-2">
    <p className="text-xs text-slate-600">JPEG, PNG hoặc WebP, tối đa 5 MiB mỗi ảnh.</p>
    {query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => { void query.refetch() }} />
      : query.data.length ? <DialogList key={roomId} label="Phân trang ảnh phòng" pageSize={1}
        items={query.data.map((image, index) => <li key={image.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-slate-200 p-2">
          <a href={apiAssetUrl(image.previewUrl)} target="_blank" rel="noreferrer" className="self-start">
            <Picture label={`Phòng — ảnh ${index + 1}`} src={apiAssetUrl(image.previewUrl)} className="aspect-auto h-20 w-24 rounded-md sm:w-32" />
          </a>
          <div className="grid min-w-0 content-center justify-items-start gap-1">
            {index === 0 ? <span className="text-sm font-semibold text-[#1E3A5F]">Ảnh đại diện</span> : <button type="button"
              className="text-left text-xs font-semibold text-[#1E3A5F] underline disabled:opacity-50" disabled={locked || busy}
              onClick={() => { void run(() => api.primaryRoomImage(roomId, image.id), 'Đã chọn ảnh đại diện.') }}>Đặt làm ảnh đại diện</button>}
            {!image.illustrative && image.attributionText && <p className="max-w-full truncate text-xs text-slate-500" title={image.attributionText}>{image.attributionText}</p>}
            <Button type="button" variant="ghost" size="sm" className="px-0 text-red-700" disabled={locked || busy}
              aria-label={`Xóa ảnh ${index + 1}`} onClick={() => { setError(''); setDeleteId(image.id) }}><Trash2 size={14} />Xóa ảnh</Button>
          </div>
        </li>)} /> : <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Chưa có ảnh phòng.</p>}
    {locked ? <p className="text-sm text-amber-800">Ảnh tạm khóa khi khách sạn chờ duyệt.</p> : <div className="flex flex-wrap gap-2">
      <label className="inline-flex min-h-9 min-w-0 cursor-pointer items-center rounded-lg border border-slate-300 px-2 text-sm font-semibold text-[#1E3A5F] focus-within:ring-2 has-disabled:opacity-50">
        <span className="max-w-28 truncate" title={file?.name}>{file?.name ?? 'Chọn ảnh phòng'}</span>
        <input ref={input} className="sr-only" aria-label="Chọn ảnh phòng" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
          onChange={event => { setFile(event.target.files?.[0]); setError(''); setMessage('') }} />
      </label>
      <Button type="button" size="sm" className="whitespace-nowrap px-2 text-sm! sm:px-3" disabled={!file || busy} onClick={upload}><Upload size={14} className="hidden sm:block" />{busy ? 'Đang xử lý…' : 'Tải ảnh phòng lên'}</Button>
    </div>}
    <div aria-live="polite"><Feedback kind="error" message={error} /><Feedback message={message} /></div>
    <Dialog open={Boolean(deleteId)} onOpenChange={open => { if (!open && !busy) setDeleteId(null) }}><DialogContent title="Xóa ảnh phòng?" description="Ảnh sẽ được gỡ khỏi phòng này."><Feedback kind="error" message={error} /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleteId(null)}>Hủy</Button><Button type="button" variant="danger" disabled={busy || locked} onClick={() => { if (deleteId) void run(() => api.deleteRoomImage(roomId, deleteId), 'Đã xóa ảnh phòng.') }}>Xác nhận xóa</Button></div></DialogContent></Dialog>
  </div>
}

export function PublicRoomGallery({ roomId, name, fallback, enabled = true }: { roomId: string; name: string; fallback?: string; enabled?: boolean }) {
  const query = useQuery({ queryKey: ['room-images', roomId, 'public'], queryFn: () => api.roomImages(roomId), enabled })
  const [selectedId, setSelectedId] = useState<string>()
  const images = query.data ?? []
  const image = images.find(item => item.id === selectedId) ?? images[0]
  return <figure><Picture label={name} src={image ? apiAssetUrl(image.url) : fallback} className="h-44 w-full rounded-lg" />
    {images.length > 1 && <div className="mt-2 flex gap-2 overflow-x-auto">{images.map((item, index) => <button type="button" key={item.id} aria-label={`Xem ảnh phòng ${index + 1}`} aria-pressed={item.id === image?.id} onClick={() => setSelectedId(item.id)} className="w-16 shrink-0 rounded border p-1"><Picture label={`${name} ${index + 1}`} src={apiAssetUrl(item.url)} /></button>)}</div>}
    {!image?.illustrative && image?.attributionText && <figcaption className="mt-1 text-xs text-slate-500">{image.attributionText}{image.sourceUrl && <> · <a href={image.sourceUrl} target="_blank" rel="noreferrer" className="underline">Nguồn ảnh</a></>}</figcaption>}
  </figure>
}
