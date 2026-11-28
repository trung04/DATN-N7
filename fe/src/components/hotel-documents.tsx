import { DateField } from '@/components/ui/date-input'
import { PaginatedList } from '@/components/paginated-list'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Upload, X } from 'lucide-react'
import { Card, Feedback, FormField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DialogList } from '@/components/ui/dialog-sections'
import { HotelDocumentImages } from './hotel-document-images'
import { api, apiAssetUrl } from '@/services/api/client'
import { day, errorMessage } from '@/lib/utils'
import type { HotelDocumentType, HotelDocumentUploadInput, PartnerHotel, PartnerHotelDocument } from '@/types/domain'

const labels: Record<HotelDocumentType, string> = { BUSINESS_LICENSE: 'Giấy phép kinh doanh', HOTEL_LICENSE: 'Giấy phép hoạt động khách sạn', OWNERSHIP_DOCUMENT: 'Giấy tờ sở hữu', TAX_DOCUMENT: 'Chứng từ thuế', OTHER: 'Khác' }
const initial: HotelDocumentUploadInput = { documentType: 'BUSINESS_LICENSE', documentNumber: '', issuedAt: '', expiresAt: '' }

function FilePreview({ file, index, compact }: { file: File; index: number; compact: boolean }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  return <img ref={image} alt={`Ảnh mới ${index + 1}: ${file.name}`} className={`w-full bg-slate-50 object-contain ${compact ? 'h-12' : 'aspect-[4/3]'}`} />
}

export function HotelDocuments({ hotel, compact = false, onBusyChange }: { hotel: PartnerHotel; compact?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [draft, setDraft] = useState<HotelDocumentUploadInput>({ ...initial })
  const [files, setFiles] = useState<File[]>([])
  const [editing, setEditing] = useState<PartnerHotelDocument | null>(null)
  const [deleting, setDeleting] = useState<PartnerHotelDocument | null>(null)
  const [busy, setLocalBusy] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const editable = hotel.status === 'DRAFT' || hotel.status === 'REJECTED'
  const setBusy = (value: boolean) => { setLocalBusy(value); onBusyChange?.(value) }
  const refresh = () => queryClient.invalidateQueries({ predicate: query => ['partner-hotel', 'partner-hotels', 'admin-hotel', 'admin-hotels'].includes(String(query.queryKey[0])) })
  const reset = () => { setEditing(null); setDraft({ ...initial }); setFiles([]); if (input.current) input.current.value = '' }
  const edit = (document: PartnerHotelDocument) => {
    setEditing(document)
    setDraft({ documentType: document.documentType, documentNumber: document.documentNumber, issuedAt: document.issuedAt ?? '', expiresAt: document.expiresAt ?? '' })
    setFiles([]); if (input.current) input.current.value = ''
    setError(''); setMessage('')
    if (compact) setEditorOpen(true)
    else formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }
  const selectFiles = (selected: File[]) => {
    setError(''); setMessage('')
    if (selected.length > 3 || selected.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024)) {
      setError('Chọn tối đa 3 ảnh JPEG, PNG hoặc WebP, mỗi ảnh tối đa 5 MiB.'); setFiles([]); if (input.current) input.current.value = ''; return
    }
    setFiles(selected)
  }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setMessage('')
    if (!editable || busy) return
    if (!editing && !files.length) { setError('Vui lòng chọn từ 1 đến 3 ảnh giấy tờ.'); return }
    if (draft.issuedAt && draft.expiresAt && draft.issuedAt > draft.expiresAt) { setError('Ngày hết hạn không được trước ngày cấp.'); return }
    setBusy(true)
    try {
      const payload = { ...draft, documentNumber: draft.documentNumber.trim(), issuedAt: draft.issuedAt || null, expiresAt: draft.expiresAt || null }
      await api.uploadHotelDocument(hotel.id, payload, files, editing?.id)
      reset(); setEditorOpen(false); setMessage(editing ? 'Đã cập nhật giấy tờ.' : 'Đã tải ảnh và thêm giấy tờ.'); await refresh()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!deleting || !editable || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      await api.deleteHotelDocument(hotel.id, deleting.id)
      if (editing?.id === deleting.id) reset()
      setDeleting(null); setMessage('Đã xóa giấy tờ.'); await refresh()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const editor = <form ref={formRef} onSubmit={save} className={compact ? 'hotel-creation-fields grid gap-2.5' : 'mt-5 grid gap-4 border-t border-slate-200 pt-5'}>
    {!compact && <h3 className="font-semibold">{editing ? 'Sửa giấy tờ' : 'Thêm giấy tờ'}</h3>}
    <fieldset disabled={busy} className={`grid min-w-0 ${compact ? 'grid-cols-2 gap-2.5' : 'gap-4 sm:grid-cols-2'}`}>
      <FormField label="Loại giấy tờ"><select value={draft.documentType} onChange={event => setDraft({ ...draft, documentType: event.target.value as HotelDocumentType })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
      <FormField label="Số giấy tờ"><input required pattern=".*\S.*" maxLength={100} value={draft.documentNumber} onChange={event => setDraft({ ...draft, documentNumber: event.target.value })} /></FormField>
      <DateField label="Ngày cấp" value={draft.issuedAt ?? ''} onChange={value => setDraft({ ...draft, issuedAt: value })} />
      <DateField label="Ngày hết hạn" min={draft.issuedAt || undefined} value={draft.expiresAt ?? ''} onChange={value => setDraft({ ...draft, expiresAt: value })} />
      <div className="col-span-full min-w-0">
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-[#1E3A5F] focus-within:ring-2">
            Chọn ảnh giấy tờ
            <input ref={input} aria-label="Ảnh giấy tờ" className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => selectFiles(Array.from(event.target.files ?? []))} />
          </label>
          <p className="mt-1 text-xs text-slate-600">{editing ? 'Chọn ảnh mới để thay bộ ảnh hiện tại.' : '1–3 ảnh JPEG, PNG hoặc WebP, tối đa 5 MiB mỗi ảnh.'}</p>
      </div>
    </fieldset>
    {files.length > 0 && <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>{files.map((file, index) => <figure key={`${file.name}-${index}`} className="min-w-0 overflow-hidden rounded-lg border border-slate-200"><FilePreview file={file} index={index} compact={compact} /><figcaption className="flex items-center justify-between gap-1 p-1"><span className="truncate text-xs" title={file.name}>{file.name}</span><button type="button" className="shrink-0 rounded p-1 text-slate-700 hover:bg-slate-100" disabled={busy} aria-label={`Bỏ ảnh ${index + 1}`} onClick={() => { setFiles(current => current.filter((_, i) => i !== index)); if (input.current) input.current.value = '' }}><X size={15} /></button></figcaption></figure>)}</div>}
    {compact && <Feedback message={error} kind="error" />}
    <div className="flex flex-wrap gap-2"><Button disabled={busy}><Upload size={16} />{busy ? 'Đang lưu…' : editing ? 'Lưu giấy tờ' : 'Tải ảnh và thêm giấy tờ'}</Button>{editing && !compact && <Button type="button" disabled={busy} variant="secondary" onClick={() => { reset(); setError('') }}>Hủy sửa</Button>}</div>
  </form>

  return <Card className={compact ? 'grid min-w-0 gap-2.5 p-3 sm:p-4' : 'mt-5 max-w-4xl p-6'}>
    <h2 className="text-lg font-semibold">Giấy tờ pháp lý</h2>
    {(message || (error && !editorOpen)) && <div><Feedback message={message} /><Feedback message={error} kind="error" /></div>}
    {compact ? <>
      {hotel.documents.length ? <DialogList label="Phân trang giấy tờ pháp lý" pageSize={1} items={hotel.documents.map(document => <li key={document.id} className="grid gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
        <div className="min-w-0"><p className="truncate font-medium" title={`${labels[document.documentType]} · ${document.documentNumber}`}>{labels[document.documentType]} · {document.documentNumber}</p><p className="text-xs text-slate-600">{document.expiresAt ? `Hết hạn ${day(document.expiresAt)}` : 'Không thời hạn'}</p></div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[#1E3A5F]">
          {document.files?.length ? document.files.map((file, index) => <a key={file.id} href={apiAssetUrl(file.url)} target="_blank" rel="noreferrer" className="underline">Ảnh {index + 1}</a>) : <a href={apiAssetUrl(document.fileUrl)} target="_blank" rel="noreferrer" className="underline">Mở giấy tờ</a>}
          {editable && <><button type="button" className="underline disabled:opacity-50" disabled={busy} onClick={() => edit(document)}>Sửa</button><button type="button" className="text-red-700 underline disabled:opacity-50" disabled={busy} onClick={() => { setError(''); setDeleting(document) }}>Xóa</button></>}
        </div>
      </li>)} /> : <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Thêm giấy phép kinh doanh còn hiệu lực để nộp hồ sơ.</p>}
      {editable && <Button type="button" variant="secondary" size="sm" className="w-fit" disabled={busy} onClick={() => { reset(); setError(''); setMessage(''); setEditorOpen(true) }}>Thêm giấy tờ</Button>}
      <Dialog open={editorOpen && editable} onOpenChange={open => { if (!open && !busy) { setEditorOpen(false); reset(); setError('') } }}>
        <DialogContent title={editing ? 'Sửa giấy tờ' : 'Thêm giấy tờ'} layout="workspace" className="max-w-lg">{editor}</DialogContent>
      </Dialog>
    </> : <>
    {hotel.documents.length ? <PaginatedList key={hotel.id} items={hotel.documents} label="Phân trang giấy tờ pháp lý">{visible => <div className="mt-4 grid gap-3">{visible.map(document => <article key={document.id} className="min-w-0 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="break-words font-medium">{labels[document.documentType]} · {document.documentNumber}</p>{editable && <div className="flex gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={busy} aria-label={`Sửa giấy tờ ${document.documentNumber}`} onClick={() => edit(document)}><Pencil size={15} />Sửa</Button>
        <Button type="button" size="sm" variant="danger" disabled={busy} aria-label={`Xóa giấy tờ ${document.documentNumber}`} onClick={() => { setDeleting(document); setError('') }}><Trash2 size={15} />Xóa</Button>
      </div>}</div>
      <HotelDocumentImages document={document} />
      <p className="mt-2 text-xs text-slate-500">Cấp: {document.issuedAt ? day(document.issuedAt) : '—'} · Hết hạn: {document.expiresAt ? day(document.expiresAt) : 'Không thời hạn'}</p>
    </article>)}</div>}</PaginatedList> : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có giấy tờ được khai báo.</p>}
    {editable ? editor : <p className="mt-4 text-sm text-slate-500">Chỉ có thể sửa giấy tờ khi hồ sơ là bản nháp hoặc bị từ chối.</p>}
    </>}
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !busy) setDeleting(null) }}><DialogContent title="Xóa giấy tờ?" description={deleting ? `${labels[deleting.documentType]} · ${deleting.documentNumber}` : undefined}>
      <p className="text-sm text-slate-600">Giấy tờ và các ảnh đính kèm sẽ được xóa.</p><Feedback message={error} kind="error" /><div className="mt-4 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Hủy</Button><Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}>Xác nhận xóa</Button></div>
    </DialogContent></Dialog>
  </Card>
}
