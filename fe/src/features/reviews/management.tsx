import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { api } from '@/services/api/client'
import { day, errorMessage } from '@/lib/utils'
import type { PartnerHotelQuery, ReviewManagementQuery, ReviewModerationAction, ReviewStatus } from '@/types/domain'

const hotelsQuery: PartnerHotelQuery = { page: 1, limit: 100, sortBy: 'name', sortOrder: 'ASC' }
const statuses: ReviewStatus[] = ['PENDING', 'VISIBLE', 'HIDDEN']
const statusLabel: Record<ReviewStatus, string> = { PENDING: 'Chờ duyệt', VISIBLE: 'Đang hiển thị', HIDDEN: 'Đã ẩn' }

export function ReviewManagementPage({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const hotels = useQuery({ queryKey: [admin ? 'admin' : 'partner', 'review-hotels'], queryFn: () => admin ? api.adminHotels(hotelsQuery) : api.myHotels(hotelsQuery) })
  const selectedHotelId = params.get('hotelId') || (admin ? '' : hotels.data?.data[0]?.id || '')
  const page = Number(params.get('page') || 1)
  const query = useMemo<ReviewManagementQuery>(() => ({
    page, limit: 20,
    sortBy: (params.get('sortBy') as ReviewManagementQuery['sortBy'] | null) ?? 'createdAt',
    sortOrder: (params.get('sortOrder') as ReviewManagementQuery['sortOrder'] | null) ?? 'DESC',
    ...(selectedHotelId ? { hotelId: selectedHotelId } : {}),
    ...(params.get('status') ? { status: params.get('status') as ReviewStatus } : {}),
    ...(params.get('stars') ? { stars: Number(params.get('stars')) } : {}),
    ...(params.get('search') ? { search: params.get('search')! } : {}),
    ...(params.get('createdFrom') ? { createdFrom: params.get('createdFrom')! } : {}),
    ...(params.get('createdTo') ? { createdTo: params.get('createdTo')! } : {}),
  }), [page, params, selectedHotelId])
  const reviews = useQuery({ queryKey: ['managed-reviews', admin, query], queryFn: () => api.reviewPage(query), enabled: admin || Boolean(selectedHotelId) })
  const summary = useQuery({ queryKey: ['review-summary', selectedHotelId], queryFn: () => api.reviewSummary(selectedHotelId), enabled: Boolean(selectedHotelId) })
  const [selectedId, setSelectedId] = useState('')
  const detail = useQuery({ queryKey: ['managed-review', selectedId], queryFn: () => api.managedReview(selectedId), enabled: Boolean(selectedId) })
  const history = useQuery({ queryKey: ['review-history', selectedId], queryFn: () => api.reviewHistory(selectedId), enabled: Boolean(selectedId && admin) })
  const [action, setAction] = useState<ReviewModerationAction | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const changeParams = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) value ? next.set(key, value) : next.delete(key)
    next.set('page', '1'); setParams(next, { replace: true })
  }
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['managed-reviews'] })
    if (selectedId) {
      await queryClient.invalidateQueries({ queryKey: ['managed-review', selectedId] })
      await queryClient.invalidateQueries({ queryKey: ['review-history', selectedId] })
    }
    if (selectedHotelId) await queryClient.invalidateQueries({ queryKey: ['review-summary', selectedHotelId] })
    await queryClient.invalidateQueries({ queryKey: ['catalog'] })
  }
  const startModeration = (next: ReviewModerationAction) => { setAction(next); setReason(''); setNote(''); setError('') }
  const moderate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!detail.data || !action) return
    if (action === 'HIDE' && !reason.trim()) { setError('Nhập lý do ẩn đánh giá.'); return }
    setBusy(true); setError('')
    try {
      await api.moderateManagedReview(detail.data.id, action, reason.trim() || undefined, note.trim() || undefined)
      await refresh(); setAction(null); setNotice('Đã cập nhật trạng thái đánh giá.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }

  if (hotels.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (!admin && hotels.data.data.length === 0) return <EmptyState title="Bạn chưa có khách sạn" description="Tạo hồ sơ khách sạn để xem đánh giá của khách." />
  if (reviews.isPending) return <LoadingState />
  if (reviews.isError) return <ErrorState message={errorMessage(reviews.error)} retry={() => { void reviews.refetch() }} />
  const hotelName = (hotelId: string) => hotels.data.data.find(hotel => hotel.id === hotelId)?.name ?? hotelId

  return <div>
    <PageHeader title={admin ? 'Kiểm duyệt đánh giá' : 'Đánh giá khách sạn'} description={admin ? 'Duyệt đánh giá mới và xử lý nội dung vi phạm. Chỉ đánh giá đang hiển thị được tính vào điểm trung bình.' : 'Theo dõi đánh giá và điểm trung bình của khách sạn bạn quản lý.'} />
    <Card className="mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <FormField label="Khách sạn"><select value={selectedHotelId} onChange={event => changeParams({ hotelId: event.target.value || undefined })}><option value="">{admin ? 'Tất cả khách sạn' : 'Chọn khách sạn'}</option>{hotels.data.data.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></FormField>
      <FormField label="Tìm nội dung, khách hoặc mã booking"><input value={params.get('search') ?? ''} onChange={event => changeParams({ search: event.target.value || undefined })} placeholder="Từ khóa" /></FormField>
      <FormField label="Trạng thái"><select value={params.get('status') ?? ''} onChange={event => changeParams({ status: event.target.value || undefined })}><option value="">Tất cả</option>{statuses.map(status => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></FormField>
      <FormField label="Số sao"><select value={params.get('stars') ?? ''} onChange={event => changeParams({ stars: event.target.value || undefined })}><option value="">Tất cả</option>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} sao</option>)}</select></FormField>
      <FormField label="Ngày gửi từ"><input type="date" value={params.get('createdFrom') ?? ''} onChange={event => changeParams({ createdFrom: event.target.value || undefined })} /></FormField>
      <FormField label="Ngày gửi đến"><input type="date" value={params.get('createdTo') ?? ''} onChange={event => changeParams({ createdTo: event.target.value || undefined })} /></FormField>
      <FormField label="Sắp xếp"><select value={`${query.sortBy}:${query.sortOrder}`} onChange={event => { const [sortBy, sortOrder] = event.target.value.split(':'); changeParams({ sortBy, sortOrder }) }}><option value="createdAt:DESC">Mới nhất</option><option value="createdAt:ASC">Cũ nhất</option><option value="stars:DESC">Nhiều sao nhất</option><option value="stars:ASC">Ít sao nhất</option></select></FormField>
    </Card>
    {selectedHotelId && summary.data && <div className="mb-5 grid gap-3 sm:grid-cols-3"><Card className="p-4"><p className="text-sm text-slate-500">Điểm trung bình đang hiển thị</p><p className="mt-1 flex items-center gap-1 text-2xl font-semibold"><Star size={19} className="fill-amber-400 text-amber-500" />{summary.data.averageRating.toFixed(1)} / 5</p></Card><Card className="p-4"><p className="text-sm text-slate-500">Đánh giá đang hiển thị</p><p className="mt-1 text-2xl font-semibold">{summary.data.visibleCount}</p></Card>{summary.data.pendingCount !== undefined && <Card className="p-4"><p className="text-sm text-slate-500">Chờ duyệt</p><p className="mt-1 text-2xl font-semibold">{summary.data.pendingCount}</p></Card>}</div>}
    <Feedback message={notice} />
    {reviews.data.data.length ? <><Card className="table-scroll mt-4"><table><thead><tr><th>Khách sạn</th><th>Khách / booking</th><th>Điểm</th><th>Nội dung</th><th>Trạng thái</th><th>Ngày gửi</th><th>Chi tiết</th></tr></thead><tbody>{reviews.data.data.map(review => <tr key={review.id}><td>{hotelName(review.hotelId)}</td><td><strong>{review.reviewerName || 'Khách hàng'}</strong><span className="block text-xs text-slate-500">{review.bookingCode || review.bookingId}</span></td><td><span className="text-amber-600">{'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}</span><span className="ml-1 text-xs">{review.stars}/5</span></td><td className="max-w-md whitespace-normal">{review.content.length > 140 ? `${review.content.slice(0, 140)}…` : review.content}</td><td><StatusBadge status={review.status} /></td><td>{day(review.createdAt)}</td><td><Button size="sm" variant="secondary" onClick={() => { setSelectedId(review.id); setAction(null); setNotice(''); setError('') }}><Eye size={15} />Mở</Button></td></tr>)}</tbody></table></Card><div className="mt-4 flex items-center justify-between text-sm"><span>{reviews.data.meta.total} đánh giá · trang {page}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => changeParams({ page: String(page - 1) })}>Trước</Button><Button variant="secondary" disabled={page * 20 >= reviews.data.meta.total} onClick={() => changeParams({ page: String(page + 1) })}>Tiếp</Button></div></div></> : <EmptyState title="Chưa có đánh giá phù hợp" description="Đánh giá mới từ booking hoàn tất sẽ xuất hiện tại đây." />}

    <Dialog open={Boolean(selectedId)} onOpenChange={open => { if (!open) { setSelectedId(''); setAction(null); setError('') } }}><DialogContent title={detail.data ? `Đánh giá ${detail.data.stars}/5` : 'Chi tiết đánh giá'}>
      {detail.isPending ? <LoadingState /> : detail.isError ? <ErrorState message={errorMessage(detail.error)} retry={() => { void detail.refetch() }} /> : detail.data ? <div className="grid max-h-[75vh] gap-4 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{hotelName(detail.data.hotelId)}</p><p className="text-sm text-slate-500">{detail.data.reviewerName} · booking {detail.data.bookingCode}</p></div><StatusBadge status={detail.data.status} /></div>
        <Card className="p-4"><p className="text-amber-600">{'★'.repeat(detail.data.stars)}{'☆'.repeat(5 - detail.data.stars)} <span className="text-sm text-slate-600">{detail.data.stars}/5</span></p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{detail.data.content}</p></Card>
        {detail.data.moderationReason && <p className="rounded-lg bg-slate-50 p-3 text-sm"><strong>Lý do xử lý:</strong> {detail.data.moderationReason}</p>}
        {admin && <Card className="p-4"><h3 className="font-semibold">Lịch sử kiểm duyệt</h3>{history.isPending ? <LoadingState /> : history.isError ? <ErrorState message={errorMessage(history.error)} retry={() => { void history.refetch() }} /> : history.data?.length ? <ul className="mt-3 grid gap-2 text-sm">{history.data.map(item => <li key={item.id}><strong>{item.action}</strong> · {day(item.createdAt)}{item.reason ? ` · ${item.reason}` : ''}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Chưa có thao tác kiểm duyệt.</p>}</Card>}
        <Feedback message={error} kind="error" /><Feedback message={notice} />
        {admin && !action && <div className="flex flex-wrap justify-end gap-2">{detail.data.status === 'PENDING' && <Button onClick={() => startModeration('APPROVE')}>Duyệt hiển thị</Button>}{detail.data.status !== 'HIDDEN' && <Button variant="danger" onClick={() => startModeration('HIDE')}>Ẩn đánh giá</Button>}{detail.data.status === 'HIDDEN' && <Button onClick={() => startModeration('RESTORE')}>Khôi phục</Button>}</div>}
        {action && <form className="grid gap-3 rounded-lg border border-slate-200 p-4" onSubmit={moderate}><h3 className="font-semibold">{action === 'APPROVE' ? 'Duyệt đánh giá' : action === 'HIDE' ? 'Ẩn đánh giá' : 'Khôi phục đánh giá'}</h3>{action === 'HIDE' && <FormField label="Lý do ẩn"><textarea required minLength={1} maxLength={5000} value={reason} onChange={event => setReason(event.target.value)} /></FormField>}{action !== 'HIDE' && <FormField label="Ghi chú (không bắt buộc)"><textarea maxLength={5000} value={note} onChange={event => setNote(event.target.value)} /></FormField>}<Feedback message={error} kind="error" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setAction(null)}>Quay lại</Button><Button disabled={busy}>{busy ? 'Đang lưu...' : 'Xác nhận'}</Button></div></form>}
      </div> : null}
    </DialogContent></Dialog>
  </div>
}
