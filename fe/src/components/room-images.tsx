import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, ErrorState, Feedback, LoadingState, Picture } from './common'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { api, apiAssetUrl } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'

export function RoomImages({ roomId, locked }: { roomId: string; locked: boolean }) {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['room-images', roomId, 'managed'], queryFn: () => api.roomImages(roomId, true) })
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setMessage('')
    try {
      await action(); setMessage(success); setDeleteId(null)
      await client.invalidateQueries({ predicate: q => ['room-images', 'partner-managed-room', 'partner-managed-rooms', 'catalog'].includes(String(q.queryKey[0])) })
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const upload = () => {
    const file = input.current?.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
      setError('Chọn ảnh JPEG, PNG hoặc WebP, tối đa 5 MiB.'); return
    }
    void run(async () => { await api.uploadRoomImage(roomId, file); if (input.current) input.current.value = '' }, 'Đã tải ảnh phòng lên.')
  }
  return <Card className="mt-6 max-w-4xl p-6">
    <h2 className="text-lg font-semibold">Ảnh phòng</h2>
    <p className="mt-2 text-sm text-slate-500">Đăng ảnh đúng phòng này. Ảnh đầu tiên là ảnh đại diện. JPEG, PNG hoặc WebP, tối đa 5 MiB mỗi ảnh.</p>
    {query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => { void query.refetch() }} /> : <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{query.data.map((image, index) => <figure key={image.id} className="overflow-hidden rounded-lg border">
      <a href={apiAssetUrl(image.previewUrl)} target="_blank" rel="noreferrer"><Picture label={`Phòng — ảnh ${index + 1}`} src={apiAssetUrl(image.previewUrl)} /></a>
      <figcaption className="grid gap-2 p-3">
        {index === 0 ? <span className="text-sm font-semibold">Ảnh đại diện</span> : <Button type="button" variant="secondary" disabled={locked || busy} onClick={() => { void run(() => api.primaryRoomImage(roomId, image.id), 'Đã chọn ảnh đại diện.') }}>Đặt làm ảnh đại diện</Button>}
        {!image.illustrative && image.attributionText && <p className="text-xs text-slate-500">{image.attributionText}</p>}
        <Button type="button" variant="danger" disabled={locked || busy} onClick={() => setDeleteId(image.id)}>Xóa ảnh {index + 1}</Button>
      </figcaption>
    </figure>)}</div>}
    {query.data?.length === 0 && <p className="mt-4 text-sm text-slate-500">Chưa có ảnh phòng.</p>}
    {locked ? <p className="mt-4 text-amber-800">Ảnh tạm khóa khi khách sạn chờ duyệt.</p> : <div className="mt-5 flex flex-wrap gap-3"><input ref={input} aria-label="Chọn ảnh phòng" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} /><Button type="button" disabled={busy} onClick={upload}>{busy ? 'Đang xử lý…' : 'Tải ảnh phòng lên'}</Button></div>}
    <div aria-live="polite"><Feedback kind="error" message={error} /><Feedback message={message} /></div>
    <Dialog open={Boolean(deleteId)} onOpenChange={open => { if (!open && !busy) setDeleteId(null) }}><DialogContent title="Xóa ảnh phòng?" description="Ảnh sẽ được gỡ khỏi phòng này."><Feedback kind="error" message={error} /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleteId(null)}>Hủy</Button><Button type="button" variant="danger" disabled={busy || locked} onClick={() => { if (deleteId) void run(() => api.deleteRoomImage(roomId, deleteId), 'Đã xóa ảnh phòng.') }}>Xác nhận xóa</Button></div></DialogContent></Dialog>
  </Card>
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
