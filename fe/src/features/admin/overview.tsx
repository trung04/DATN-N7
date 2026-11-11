import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Hotel, UsersRound } from 'lucide-react'
import { Card, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { api } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'

const userQuery = { page: 1, limit: 100, sortBy: 'createdAt' as const, sortOrder: 'DESC' as const }
const hotelQuery = { page: 1, limit: 100, sortBy: 'createdAt' as const, sortOrder: 'DESC' as const }

export function AdminOverviewPage() {
  const users = useQuery({ queryKey: ['admin-overview-users'], queryFn: () => api.adminUsers(userQuery) })
  const owners = useQuery({ queryKey: ['admin-overview-owners'], queryFn: () => api.hotelOwners(1, 1) })
  const hotels = useQuery({ queryKey: ['admin-overview-hotels'], queryFn: () => api.adminHotels(hotelQuery) })
  if (users.isPending || owners.isPending || hotels.isPending) return <LoadingState />
  if (users.isError) return <ErrorState message={errorMessage(users.error)} retry={() => { void users.refetch() }} />
  if (owners.isError) return <ErrorState message={errorMessage(owners.error)} retry={() => { void owners.refetch() }} />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  const pending = hotels.data.data.filter(hotel => hotel.status === 'PENDING_APPROVAL')
  return <div>
    <PageHeader title="Tổng quan quản trị" description="Số liệu được lấy từ danh sách người dùng và khách sạn trên backend." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Người dùng" value={users.data.meta.total} icon={<UsersRound size={20} />} href="/admin/users" />
      <Metric label="Chủ khách sạn" value={owners.data.meta.total} icon={<Hotel size={20} />} href="/admin/partners" />
      <Metric label="Khách sạn" value={hotels.data.meta.total} icon={<Hotel size={20} />} href="/admin/hotels" />
      <Metric label="Chờ duyệt" value={pending.length} icon={<Hotel size={20} />} href="/admin/hotels?status=PENDING_APPROVAL" />
    </div>
    <Card className="mt-6 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Khách sạn chờ duyệt</h2><p className="text-sm text-slate-500">Các hồ sơ đang chờ quản trị viên xử lý.</p></div><Link className="text-sm font-semibold text-[#1E3A5F]" to="/admin/hotels">Mở danh sách</Link></div>
      {pending.length ? <div className="mt-4 divide-y divide-slate-100">{pending.slice(0, 5).map(hotel => <Link key={hotel.id} to={`/admin/hotels/${hotel.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><strong>{hotel.name}</strong><span className="ml-2 text-sm text-slate-500">{hotel.address}</span></span><StatusBadge status={hotel.status} /></Link>)}</div> : <p className="mt-4 text-sm text-slate-500">Không có hồ sơ chờ duyệt trong dữ liệu đã tải.</p>}
    </Card>
    <p className="mt-4 text-xs text-slate-500">Thẻ tổng số lấy từ tổng phân trang API. Danh sách chờ duyệt hiển thị trong phạm vi 100 khách sạn mới nhất.</p>
  </div>
}

function Metric({ label, value, icon, href }: { label: string; value: number; icon: ReactNode; href: string }) {
  return <Link to={href}><Card className="p-5 transition hover:border-[#9CB4C9]"><div className="flex items-center justify-between text-slate-500"><span className="text-sm">{label}</span>{icon}</div><p className="mt-4 text-3xl font-semibold text-[#1E3A5F]">{value}</p></Card></Link>
}
import type { ReactNode } from 'react'
