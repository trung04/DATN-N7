import { LockKeyhole } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import type { PartnerHotel } from '@/types/domain'

export function HotelManagementLocked({ hotel }: { hotel?: PartnerHotel }) {
  const pending = hotel?.status === 'PENDING_APPROVAL'
  return <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[#1E3A5F]"><LockKeyhole size={17} aria-hidden="true" /></span>
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-slate-900">{pending ? 'Khách sạn đang chờ duyệt' : hotel ? 'Khách sạn chưa hoạt động' : 'Chưa có khách sạn hoạt động'}</p>
      <p className="mt-1">{pending ? 'Bạn có thể xem hồ sơ và theo dõi kết quả. Các thao tác quản lý sẽ mở khi khách sạn hoạt động.' : 'Các thao tác quản lý dành cho khách sạn đang hoạt động.'}</p>
    </div>
    <Button asChild variant="secondary" size="sm"><Link to={hotel ? `/partner/hotels/${hotel.id}/edit?step=review` : '/partner/hotels'}>{hotel ? 'Xem hồ sơ' : 'Xem danh sách khách sạn'}</Link></Button>
  </div>
}
