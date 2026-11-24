import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/common'
import { api } from '@/services/api/client'
import { isMock } from '@/services'
import { useSession } from '@/stores/session'

const dateTime = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value))

export function NotificationsPage() {
  const user = useSession(state => state.user)
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const notifications = useQuery({
    queryKey: ['notifications', user?.id, page],
    queryFn: () => api.notifications(page, 20),
    enabled: user?.role === 'tourist' && !isMock,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] })
  const markRead = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: refresh,
  })
  const markAllRead = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: refresh,
  })

  if (isMock) {
    return <div className="container-app section-pad"><PageHeader title="Thông báo" /><EmptyState title="Chưa có thông báo" /></div>
  }
  if (notifications.isLoading) return <div className="container-app section-pad"><LoadingState /></div>
  if (notifications.error) return <div className="container-app section-pad"><ErrorState message="Không tải được thông báo." retry={() => { void notifications.refetch() }} /></div>

  const result = notifications.data!
  const pageCount = Math.max(1, Math.ceil(result.meta.total / result.meta.limit))
  return <div className="container-app section-pad">
    <PageHeader
      title="Thông báo"
      description="Cập nhật về booking, thanh toán, hủy và hoàn tiền."
      actions={<Button variant="secondary" disabled={!result.meta.unreadCount || markAllRead.isPending} onClick={() => markAllRead.mutate()}><CheckCheck size={16} />Đánh dấu tất cả đã đọc</Button>}
    />
    {result.data.length ? <>
      <div className="grid gap-3">
        {result.data.map(item => <Card key={item.id} className={'p-5 ' + (item.readAt ? '' : 'border-l-4 border-l-[#3B82F6]')}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF0F6] text-[#1E3A5F]"><Bell size={17} /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{item.title}</h2>{!item.readAt && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Mới</span>}</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
                <p className="mt-2 text-xs text-slate-500">{dateTime(item.createdAt)}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
              <Button asChild variant="secondary" size="sm"><Link to={item.link}>Xem booking</Link></Button>
              {!item.readAt && <Button variant="ghost" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate(item.id)}>Đã đọc</Button>}
            </div>
          </div>
        </Card>)}
      </div>
      {pageCount > 1 && <div className="mt-5 flex items-center justify-end gap-3 text-sm"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} />Trước</Button><span>Trang {page} / {pageCount}</span><Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}>Sau<ChevronRight size={16} /></Button></div>}
    </> : <EmptyState title="Chưa có thông báo" description="Thông báo sẽ xuất hiện khi trạng thái booking thay đổi." />}
  </div>
}
