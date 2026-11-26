import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '@/services/api/client'
import type { PlaceTaxonomy } from '@/types/domain'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { errorMessage } from '@/lib/utils'

type TaxonomyKind = 'category' | 'topic'

const labels = {
  category: { singular: 'category', title: 'Category địa điểm', description: 'Phân loại chính của địa điểm.' },
  topic: { singular: 'topic', title: 'Topic địa điểm', description: 'Chủ đề dùng để gắn thẻ địa điểm.' },
} as const

export function AdminPlaceTaxonomiesPage() {
  const queryClient = useQueryClient()
  const categories = useQuery({ queryKey: ['place-categories'], queryFn: api.placeCategories })
  const topics = useQuery({ queryKey: ['place-topics'], queryFn: api.placeTopics })
  const [kind, setKind] = useState<TaxonomyKind>('category')
  const [editing, setEditing] = useState<PlaceTaxonomy | null>(null)
  const [deleting, setDeleting] = useState<PlaceTaxonomy | null>(null)
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const openNew = (nextKind: TaxonomyKind) => {
    setKind(nextKind); setEditing(null); setCode(''); setName(''); setDescription(''); setMessage(''); setOpen(true)
  }
  const openEdit = (nextKind: TaxonomyKind, item: PlaceTaxonomy) => {
    setKind(nextKind); setEditing(item); setCode(item.code); setName(item.name); setDescription(item.description ?? ''); setMessage(''); setOpen(true)
  }
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['place-categories'] }),
      queryClient.invalidateQueries({ queryKey: ['place-topics'] }),
      queryClient.invalidateQueries({ queryKey: ['place-catalog-options'] }),
      queryClient.invalidateQueries({ queryKey: ['preference-options'] }),
    ])
  }
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (kind === 'category') {
        if (editing) await api.updatePlaceCategory(editing.id, { name: name.trim(), description: description.trim() || null })
        else await api.createPlaceCategory({ code: code.trim(), name: name.trim(), description: description.trim() || null })
      } else if (editing) await api.updatePlaceTopic(editing.id, { name: name.trim() })
      else await api.createPlaceTopic({ code: code.trim(), name: name.trim(), description: null })
      await refresh(); setOpen(false); setMessage(`Đã lưu ${labels[kind].singular}.`)
    } catch (cause) { setMessage(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!deleting) return
    setBusy(true); setMessage('')
    try {
      if (kind === 'category') await api.deletePlaceCategory(deleting.id)
      else await api.deletePlaceTopic(deleting.id)
      await refresh(); setDeleting(null); setMessage(`Đã xóa ${labels[kind].singular}.`)
    } catch (cause) { setMessage(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  if (categories.isPending || topics.isPending) return <LoadingState />
  if (categories.isError || topics.isError) return <ErrorState message={errorMessage(categories.error ?? topics.error)} />

  const section = (sectionKind: TaxonomyKind, items: PlaceTaxonomy[]) => <Card className="p-5">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{labels[sectionKind].title}</h2><p className="mt-1 text-sm text-slate-500">{labels[sectionKind].description}</p></div><Button size="sm" onClick={() => openNew(sectionKind)}><Plus size={16} />Thêm {labels[sectionKind].singular}</Button></div>
    {items.length ? <div className="mt-5 grid gap-3">{items.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><p className="font-semibold">{item.name}</p><p className="text-xs text-slate-500">{item.code}{item.description ? ` · ${item.description}` : ''}</p></div><div className="flex gap-2"><Button size="icon" variant="ghost" aria-label={`Chỉnh sửa ${item.name}`} onClick={() => openEdit(sectionKind, item)}><Pencil size={16} /></Button><Button size="icon" variant="ghost" aria-label={`Xóa ${item.name}`} onClick={() => { setKind(sectionKind); setDeleting(item); setMessage('') }}><Trash2 size={16} /></Button></div></div>)}</div> : <div className="mt-5"><EmptyState title={`Chưa có ${labels[sectionKind].singular}`} /></div>}
  </Card>

  return <div>
    <PageHeader title="Phân loại địa điểm" description="Quản lý category và topic được dùng cho địa điểm và sở thích du lịch." />
    <Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} />
    <div className="mt-4 grid gap-5 xl:grid-cols-2">{section('category', categories.data)}{section('topic', topics.data)}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent title={editing ? `Chỉnh sửa ${labels[kind].singular}` : `Thêm ${labels[kind].singular}`}><form className="grid gap-4" onSubmit={save}><FormField label="Mã" hint={editing ? 'Mã không thể thay đổi sau khi tạo.' : 'Chữ, số, gạch ngang hoặc gạch dưới.'}><input required disabled={Boolean(editing)} pattern="[A-Za-z0-9_-]{2,50}" value={code} onChange={event => setCode(event.target.value)} /></FormField><FormField label="Tên"><input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} /></FormField>{kind === 'category' && <FormField label="Mô tả"><textarea maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></FormField>}<Feedback message={message} kind="error" /><Button disabled={busy}>{busy ? 'Đang lưu...' : `Lưu ${labels[kind].singular}`}</Button></form></DialogContent></Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={next => { if (!next) setDeleting(null) }}><DialogContent title={`Xóa ${labels[kind].singular}?`} description="Không thể xóa nếu vẫn còn địa điểm hoặc sở thích đang sử dụng."><Feedback message={message} kind="error" /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleting(null)}>Hủy</Button><Button variant="danger" disabled={busy} onClick={() => { void remove() }}>{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</Button></div></DialogContent></Dialog>
  </div>
}
