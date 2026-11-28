import { DateField } from '@/components/ui/date-input'
import { loadHotelOptions } from '@/services/api/management-options'
import { Pagination } from '@/components/pagination'
import { usePagination } from '@/lib/use-pagination'
import { readPage, readPageSize } from '@/lib/pagination'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementSearch, SearchButton } from '@/components/management-search'
import { useSearchFilters } from '@/lib/use-search-filters'
import { Eye, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DialogList, DialogSections } from '@/components/ui/dialog-sections'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { api } from '@/services/api/client'
import { dateTime, day, errorMessage } from '@/lib/utils'
import type { ReviewManagementQuery, ReviewModerationAction, ReviewStatus } from '@/types/domain'

const statuses: ReviewStatus[] = ['PENDING', 'VISIBLE', 'HIDDEN']
const statusLabel: Record<ReviewStatus, string> = { PENDING: 'Chờ duyệt', VISIBLE: 'Đang hiển thị', HIDDEN: 'Đã ẩn' }

const moderationLabel: Record<string, string> = { APPROVE: 'Duyệt hiển thị', HIDE: 'Ẩn đánh giá', RESTORE: 'Khôi phục' }

export function ReviewManagementPage({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const hotels = useQuery({ queryKey: [admin ? 'admin' : 'partner', 'review-hotels'], queryFn: () => loadHotelOptions(admin) })
  const selectedHotelId = params.get('hotelId') || (admin ? '' : hotels.data?.[0]?.id || '')
  const page = readPage(params)
  const size = readPageSize(params)
  const query = useMemo<ReviewManagementQuery>(() => ({
    page, limit: size,
    sortBy: (params.get('sortBy') as ReviewManagementQuery['sortBy'] | null) ?? 'createdAt',
    sortOrder: (params.get('sortOrder') as ReviewManagementQuery['sortOrder'] | null) ?? 'DESC',
    ...(selectedHotelId ? { hotelId: selectedHotelId } : {}),
    ...(params.get('status') ? { status: params.get('status') as ReviewStatus } : {}),
    ...(params.get('stars') ? { stars: Number(params.get('stars')) } : {}),
    ...(params.get('search') ? { search: params.get('search')! } : {}),
    ...(params.get('createdFrom') ? { createdFrom: params.get('createdFrom')! } : {}),
    ...(params.get('createdTo') ? { createdTo: params.get('createdTo')! } : {}),
  }), [page, size, params, selectedHotelId])
  const { filters, changeFilters, applyFilters } = useSearchFilters(params, setParams, {
    hotelId: selectedHotelId, search: params.get('search') ?? '', status: params.get('status') ?? '',
    stars: params.get('stars') ?? '', createdFrom: params.get('createdFrom') ?? '',
    createdTo: params.get('createdTo') ?? '', sortBy: query.sortBy, sortOrder: query.sortOrder,
  })
  const reviews = useQuery({ queryKey: ['managed-reviews', admin, query], queryFn: () => api.reviewPage(query), enabled: admin || Boolean(selectedHotelId), placeholderData: keepPreviousData })
  const summary = useQuery({ queryKey: ['review-summary', selectedHotelId], queryFn: () => api.reviewSummary(selectedHotelId), enabled: Boolean(selectedHotelId) })
  const pagination = usePagination(reviews.isPlaceholderData ? undefined : reviews.data?.meta.total)
  const [selectedId, setSelectedId] = useState('')
  const detail = useQuery({ queryKey: ['managed-review', selectedId], queryFn: () => api.managedReview(selectedId), enabled: Boolean(selectedId) })
  const history = useQuery({ queryKey: ['review-history', selectedId], queryFn: () => api.reviewHistory(selectedId), enabled: Boolean(selectedId && admin) })
  const [action, setAction] = useState<ReviewModerationAction | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const moderationFormId = useId()

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
  if (!admin && hotels.data.length === 0) return <EmptyState title="Bạn chưa có khách sạn" description="Tạo hồ sơ khách sạn để xem đánh giá của khách." />
  const hotelName = (hotelId: string) => hotels.data.find(hotel => hotel.id === hotelId)?.name ?? hotelId


  const review = detail.data
  const reviewContent = review && <Card className="p-3 sm:p-4">
    <p className="text-amber-600"><span aria-hidden="true">{'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}</span> <span className="text-sm text-slate-600">{review.stars}/5</span></p>
    <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm leading-6">{review.content}</p>
    {review.moderationReason && <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
      <h3 className="font-semibold">Lý do xử lý</h3>
      <p className="mt-1 whitespace-pre-wrap wrap-anywhere">{review.moderationReason}</p>
    </div>}
  </Card>
  const moderationFooter = admin && review && (action ? <>
    <Button variant="secondary" disabled={busy} onClick={() => { setAction(null); setError('') }}>Quay lại</Button>
    <Button disabled={busy} type="submit" form={moderationFormId}>{busy ? 'Đang lưu...' : 'Xác nhận'}</Button>
  </> : <>
    {review.status === 'PENDING' && <Button onClick={() => startModeration('APPROVE')}>Duyệt hiển thị</Button>}
    {review.status !== 'HIDDEN' && <Button variant="danger" onClick={() => startModeration('HIDE')}>Ẩn đánh giá</Button>}
    {review.status === 'HIDDEN' && <Button onClick={() => startModeration('RESTORE')}>Khôi phục</Button>}
  </>)

  return <div className="management-list">
    <PageHeader title={admin ? 'Kiểm duyệt đánh giá' : 'Đánh giá khách sạn'} description={admin ? 'Duyệt đánh giá mới và xử lý nội dung vi phạm. Chỉ đánh giá đang hiển thị được tính vào điểm trung bình.' : 'Theo dõi đánh giá và điểm trung bình của khách sạn bạn quản lý.'} />
    <form aria-label="Tìm kiếm đánh giá" onSubmit={applyFilters} className="management-filters grid grid-cols-2 items-end gap-2 rounded-xl border border-slate-200 bg-white sm:grid-cols-3 xl:grid-cols-4">
      <FormField label="Khách sạn"><select required={!admin} value={filters.hotelId} onChange={event => changeFilters({ hotelId: event.target.value })}><option value="">{admin ? 'Tất cả khách sạn' : 'Chọn khách sạn'}</option>{hotels.data.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></FormField>
      <FormField label="Tìm khách hoặc Mã đặt phòng"><ManagementSearch value={filters.search} onChange={event => changeFilters({ search: event.target.value })} placeholder="Từ khóa" /></FormField>
      <FormField label="Trạng thái"><select value={filters.status} onChange={event => changeFilters({ status: event.target.value })}><option value="">Tất cả</option>{statuses.map(status => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></FormField>
      <FormField label="Số sao"><select value={filters.stars} onChange={event => changeFilters({ stars: event.target.value })}><option value="">Tất cả</option>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} sao</option>)}</select></FormField>
      <DateField label="Ngày gửi từ" value={filters.createdFrom} onChange={value => changeFilters({ createdFrom: value })} />
      <DateField label="Ngày gửi đến" value={filters.createdTo} onChange={value => changeFilters({ createdTo: value })} />
      <FormField label="Sắp xếp"><select value={`${filters.sortBy}:${filters.sortOrder}`} onChange={event => { const [sortBy, sortOrder] = event.target.value.split(':'); changeFilters({ sortBy: sortBy as typeof filters.sortBy, sortOrder: sortOrder as typeof filters.sortOrder }) }}><option value="createdAt:DESC">Mới nhất</option><option value="createdAt:ASC">Cũ nhất</option><option value="stars:DESC">Nhiều sao nhất</option><option value="stars:ASC">Ít sao nhất</option></select></FormField>
      <SearchButton className="justify-self-start" />
    </form>
    {selectedHotelId && summary.data && <div className="grid grid-cols-3 gap-1.5 sm:gap-2"><Card className="min-w-0 p-2 sm:p-4"><p className="text-xs text-slate-500 sm:text-sm">Điểm trung bình</p><p className="mt-1 flex items-center gap-1 text-lg font-semibold sm:text-2xl"><Star size={19} className="fill-amber-400 text-amber-500" />{summary.data.averageRating.toFixed(1)} / 5</p></Card><Card className="p-2 sm:p-4"><p className="text-xs text-slate-500 sm:text-sm">Đang hiển thị</p><p className="mt-1 text-2xl font-semibold">{summary.data.visibleCount}</p></Card>{summary.data.pendingCount !== undefined && <Card className="p-2 sm:p-4"><p className="text-xs text-slate-500 sm:text-sm">Chờ duyệt</p><p className="mt-1 text-2xl font-semibold">{summary.data.pendingCount}</p></Card>}</div>}
    {!selectedId && <Feedback message={notice} />}
    {reviews.isPending ? <LoadingState /> : reviews.isError ? <ErrorState message={errorMessage(reviews.error)} retry={() => { void reviews.refetch() }} /> : reviews.data.data.length ? <><Card className="table-scroll mt-4"><table><thead><tr><th className="hidden md:table-cell">Khách sạn</th><th>Khách / đơn đặt phòng</th><th className="hidden sm:table-cell">Điểm</th><th className="hidden lg:table-cell">Nội dung</th><th>Trạng thái</th><th className="hidden md:table-cell">Ngày gửi</th><th>Chi tiết</th></tr></thead><tbody>{reviews.data.data.map(review => <tr key={review.id}><td className="hidden md:table-cell">{hotelName(review.hotelId)}</td><td><strong>{review.reviewerName || 'Khách hàng'}</strong><span className="block text-xs text-slate-500">{review.bookingCode || review.bookingId}</span></td><td className="hidden sm:table-cell"><span className="whitespace-nowrap text-amber-600">{'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}</span><span className="ml-1 text-xs">{review.stars}/5</span></td><td className="hidden max-w-md whitespace-normal lg:table-cell">{review.content.length > 140 ? `${review.content.slice(0, 140)}…` : review.content}</td><td><StatusBadge status={review.status} /><span className="mt-1 block whitespace-nowrap text-xs text-slate-500 sm:hidden">★ {review.stars}/5</span></td><td className="hidden md:table-cell">{day(review.createdAt)}</td><td><Button size="sm" variant="secondary" onClick={() => { setSelectedId(review.id); setAction(null); setNotice(''); setError('') }}><Eye size={15} />Mở</Button></td></tr>)}</tbody></table></Card></> : <EmptyState title="Chưa có đánh giá phù hợp" description="Đánh giá mới từ đơn đặt phòng hoàn tất sẽ xuất hiện tại đây." />}

    {reviews.data && <Pagination page={page} total={reviews.data.meta.total} onPageChange={pagination.setPage} size={pagination.size} onSizeChange={pagination.setSize} />}
    <Dialog open={Boolean(selectedId)} onOpenChange={open => { if (!open) { setSelectedId(''); setAction(null); setError('') } }}>
      <DialogContent title={review ? `Đánh giá ${review.stars}/5` : 'Chi tiết đánh giá'} layout="workspace" footer={moderationFooter}>
        {detail.isPending ? <LoadingState /> : detail.isError ? <ErrorState message={errorMessage(detail.error)} retry={() => { void detail.refetch() }} /> : review && <div className="grid gap-3">
          {action ? <form id={moderationFormId} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:p-4" onSubmit={moderate}>
            <h3 className="font-semibold">{action === 'APPROVE' ? 'Duyệt đánh giá' : action === 'HIDE' ? 'Ẩn đánh giá' : 'Khôi phục đánh giá'}</h3>
            {action === 'HIDE'
              ? <FormField label="Lý do ẩn"><textarea required maxLength={5000} value={reason} onChange={event => setReason(event.target.value)} /></FormField>
              : <FormField label="Ghi chú (không bắt buộc)"><textarea maxLength={5000} value={note} onChange={event => setNote(event.target.value)} /></FormField>}
          </form> : <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 wrap-anywhere">
                <p className="font-semibold">{hotelName(review.hotelId)}</p>
                <p className="text-sm text-slate-500">{review.reviewerName || 'Khách hàng'} · đơn đặt phòng {review.bookingCode || review.bookingId}</p>
              </div>
              <StatusBadge status={review.status} />
            </div>
            {admin ? <DialogSections label="Chi tiết đánh giá" sections={[
              { id: 'review', label: 'Nội dung', content: reviewContent },
              { id: 'history', label: 'Lịch sử kiểm duyệt', content: <Card className="p-3 sm:p-4">
                {history.isPending ? <LoadingState /> : history.isError ? <ErrorState message={errorMessage(history.error)} retry={() => { void history.refetch() }} /> : history.data.length
                  ? <DialogList label="Trang lịch sử kiểm duyệt" pageSize={3} items={history.data.map(item => <li key={item.id} className="py-2 text-sm">
                    <p className="flex flex-wrap gap-x-3"><strong>{moderationLabel[item.action] ?? item.action}</strong><span className="text-slate-500">{dateTime(item.createdAt)}</span></p>
                    {item.reason && <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-slate-700">{item.reason}</p>}
                  </li>)} />
                  : <p className="text-sm text-slate-500">Chưa có thao tác kiểm duyệt.</p>}
              </Card> },
            ]} /> : reviewContent}
          </>}
          <Feedback message={error} kind="error" />
          <Feedback message={notice} />
        </div>}
      </DialogContent>
    </Dialog>
  </div>
}
