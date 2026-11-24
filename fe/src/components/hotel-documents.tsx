import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Upload, X } from 'lucide-react'
import { Card, Feedback, FormField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { HotelDocumentImages } from './hotel-document-images'
import { api } from '@/services/api/client'
import { day, errorMessage } from '@/lib/utils'
import type { HotelDocumentType, HotelDocumentUploadInput, PartnerHotel, PartnerHotelDocument } from '@/types/domain'

const labels: Record<HotelDocumentType, string> = { BUSINESS_LICENSE: 'Giấy phép kinh doanh', HOTEL_LICENSE: 'Giấy phép hoạt động khách sạn', OWNERSHIP_DOCUMENT: 'Giấy tờ sở hữu', TAX_DOCUMENT: 'Chứng từ thuế', OTHER: 'Khác' }
const initial: HotelDocumentUploadInput = { documentType: 'BUSINESS_LICENSE', documentNumber: '', issuedAt: '', expiresAt: '' }

function FilePreview({ file, index }: { file: File; index: number }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  return <img ref={image} alt={`Ảnh mới ${index + 1}: ${file.name}`} className="aspect-[4/3] w-full bg-slate-50 object-contain" />
}

export function HotelDocuments({ hotel }: { hotel: PartnerHotel }) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [draft, setDraft] = useState<HotelDocumentUploadInput>({ ...initial })
  const [files, setFiles] = useState<File[]>([])
  const [editing, setEditing] = useState<PartnerHotelDocument | null>(null)
  const [deleting, setDeleting] = useState<PartnerHotelDocument | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const editable = hotel.status === 'DRAFT' || hotel.status === 'REJECTED'
  const refresh = () => queryClient.invalidateQueries({ predicate: query => ['partner-hotel', 'partner-hotels', 'admin-hotel', 'admin-hotels'].includes(String(query.queryKey[0])) })
  const reset = () => { setEditing(null); setDraft({ ...initial }); setFiles([]); if (input.current) input.current.value = '' }
  const edit = (document: PartnerHotelDocument) => {
    setEditing(document)
    setDraft({ documentType: document.documentType, documentNumber: document.documentNumber, issuedAt: document.issuedAt ?? '', expiresAt: document.expiresAt ?? '' })
    setFiles([]); if (input.current) input.current.value = ''
    setError(''); setMessage(''); formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
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
      reset(); setMessage(editing ? 'Đã cập nhật giấy tờ.' : 'Đã tải ảnh và thêm giấy tờ.'); await refresh()
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
  return <Card className="mt-5 max-w-4xl p-6">
    <h2 className="text-lg font-semibold">Giấy tờ pháp lý</h2>
    <div className="mt-3"><Feedback message={message} /><Feedback message={error} kind="error" /></div>
    {hotel.documents.length ? <div className="mt-4 grid gap-3">{hotel.documents.map(document => <article key={document.id} className="min-w-0 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="break-words font-medium">{labels[document.documentType]} · {document.documentNumber}</p>{editable && <div className="flex gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={busy} aria-label={`Sửa giấy tờ ${document.documentNumber}`} onClick={() => edit(document)}><Pencil size={15} />Sửa</Button>
        <Button type="button" size="sm" variant="danger" disabled={busy} aria-label={`Xóa giấy tờ ${document.documentNumber}`} onClick={() => { setDeleting(document); setError('') }}><Trash2 size={15} />Xóa</Button>
      </div>}</div>
      <HotelDocumentImages document={document} />
      <p className="mt-2 text-xs text-slate-500">Cấp: {document.issuedAt ? day(document.issuedAt) : '—'} · Hết hạn: {document.expiresAt ? day(document.expiresAt) : 'Không thời hạn'}</p>
    </article>)}</div> : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có giấy tờ được khai báo.</p>}
    {editable ? <form ref={formRef} onSubmit={save} className="mt-5 grid gap-4 border-t border-slate-200 pt-5">
      <h3 className="font-semibold">{editing ? 'Sửa giấy tờ' : 'Thêm giấy tờ'}</h3>
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <FormField label="Loại giấy tờ"><select value={draft.documentType} onChange={event => setDraft({ ...draft, documentType: event.target.value as HotelDocumentType })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
        <FormField label="Số giấy tờ"><input required maxLength={100} value={draft.documentNumber} onChange={event => setDraft({ ...draft, documentNumber: event.target.value })} /></FormField>
        <FormField label="Ngày cấp"><input type="date" value={draft.issuedAt ?? ''} onChange={event => setDraft({ ...draft, issuedAt: event.target.value })} /></FormField>
        <FormField label="Ngày hết hạn"><input type="date" min={draft.issuedAt || undefined} value={draft.expiresAt ?? ''} onChange={event => setDraft({ ...draft, expiresAt: event.target.value })} /></FormField>
        <div className="min-w-0 sm:col-span-2"><FormField label="Ảnh giấy tờ" hint={editing ? 'Chọn tối đa 3 ảnh để thay bộ ảnh hiện tại. Không chọn ảnh mới sẽ giữ nguyên ảnh cũ.' : 'Chọn từ 1 đến 3 ảnh JPEG, PNG hoặc WebP, mỗi ảnh tối đa 5 MiB.'}><input ref={input} aria-label="Ảnh giấy tờ" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => selectFiles(Array.from(event.target.files ?? []))} /></FormField></div>
      </fieldset>
      {files.length > 0 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{files.map((file, index) => <figure key={`${file.name}-${index}`} className="min-w-0 overflow-hidden rounded-lg border border-slate-200"><FilePreview file={file} index={index} /><figcaption className="flex items-center justify-between gap-2 p-2"><span className="truncate text-xs">{file.name}</span><Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={`Bỏ ảnh ${index + 1}`} onClick={() => { setFiles(current => current.filter((_, i) => i !== index)); if (input.current) input.current.value = '' }}><X size={16} /></Button></figcaption></figure>)}</div>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy}><Upload size={16} />{busy ? 'Đang lưu...' : editing ? 'Lưu giấy tờ' : 'Tải ảnh và thêm giấy tờ'}</Button>{editing && <Button type="button" disabled={busy} variant="secondary" onClick={() => { reset(); setError('') }}>Hủy sửa</Button>}</div>
    </form> : <p className="mt-4 text-sm text-slate-500">Chỉ có thể sửa giấy tờ khi hồ sơ là bản nháp hoặc bị từ chối.</p>}
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !busy) setDeleting(null) }}><DialogContent title="Xóa giấy tờ?" description={deleting ? `${labels[deleting.documentType]} · ${deleting.documentNumber}` : undefined}>
      <p className="text-sm text-slate-600">Giấy tờ và các ảnh đính kèm sẽ được xóa.</p><Feedback message={error} kind="error" /><div className="mt-4 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Hủy</Button><Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}>Xác nhận xóa</Button></div>
    </DialogContent></Dialog>
  </Card>
}
