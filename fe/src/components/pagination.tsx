import { Button } from '@/components/ui/button'
import { lastPage, PAGE_SIZE, PAGE_SIZES } from '@/lib/pagination'

export function Pagination({ page, total, onPageChange, onSizeChange, size = PAGE_SIZE }: {
  page: number; total: number; onPageChange: (page: number) => void; onSizeChange: (size: number) => void; size?: number
}) {
  const count = lastPage(total, size)
  const current = Math.min(page, count)
  const pages = [...new Set([1, current - 1, current, current + 1, count])].filter(n => n >= 1 && n <= count).sort((a, b) => a - b)
  return <nav aria-label="Phân trang" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
    <span>{total ? `Hiển thị ${(current - 1) * size + 1}–${Math.min(current * size, total)} / ${total.toLocaleString('vi-VN')}` : '0 kết quả'} · Trang {current}/{count}</span>
    <label className="flex items-center gap-2">Số dòng mỗi trang
      <select className="!w-auto !min-w-0 !py-1.5" value={size} onChange={event => onSizeChange(Number(event.target.value))}>
        {PAGE_SIZES.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    <div className="flex flex-wrap items-center gap-1">
      <Button type="button" size="sm" variant="secondary" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>Trước</Button>
      {pages.map((value, index) => <span key={value} className="inline-flex items-center gap-1">{index > 0 && value - pages[index - 1]! > 1 && <span aria-hidden="true" className="px-1">…</span>}<Button type="button" size="sm" variant={value === current ? 'default' : 'secondary'} aria-label={`Trang ${value}`} aria-current={value === current ? 'page' : undefined} onClick={() => onPageChange(value)}>{value}</Button></span>)}
      <Button type="button" size="sm" variant="secondary" disabled={current >= count} onClick={() => onPageChange(current + 1)}>Sau</Button>
    </div>
  </nav>
}
