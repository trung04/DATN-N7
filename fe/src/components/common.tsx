import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Image as ImageIcon, LoaderCircle, SearchX } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './ui/button'
import { formatStatus } from '@/lib/utils'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>{description && <p className="mt-2 max-w-2xl text-slate-500">{description}</p>}</div>{actions}</div>
}
export function Card({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div> }
export function Picture({ label, src, className }: { label: string; src?: string; className?: string }) {
  return <div role={src ? undefined : 'img'} aria-label={src ? undefined : 'Chưa có ảnh minh họa ' + label} className={cn('relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#EAF0F6] text-[#69809A]', className)}>
    {src ? <img src={src} alt={'Ảnh minh họa ' + label} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <><div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,#d3e4ed_0,transparent_38%),linear-gradient(145deg,#e8eff5,#dbe8e6)]" /><ImageIcon className="relative opacity-60" size={36} strokeWidth={1.3} /></>}
  </div>
}
export function EmptyState({ title = 'Chưa có dữ liệu', description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return <Card className="flex flex-col items-center p-10 text-center"><SearchX className="mb-4 text-slate-400" size={32} /><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}{action && <div className="mt-5">{action}</div>}</Card>
}
export function LoadingState({ label = 'Đang tải dữ liệu...' }: { label?: string }) { return <div role="status" className="flex items-center justify-center gap-2 p-12 text-slate-500"><LoaderCircle className="animate-spin" size={18} />{label}</div> }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <Card className="p-8 text-center"><p className="text-red-700">{message}</p>{retry && <Button variant="secondary" className="mt-4" onClick={retry}>Thử lại</Button>}</Card> }
export function StatusBadge({ status }: { status: string }) {
  const positive = ['CONFIRMED', 'COMPLETED', 'PAID', 'VERIFIED', 'VISIBLE', 'SAVED', 'REFUNDED'].includes(status)
  const negative = ['FAILED', 'CANCELLED', 'REJECTED', 'HIDDEN', 'EXPIRED'].includes(status)
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', positive ? 'bg-emerald-50 text-emerald-800' : negative ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>{formatStatus(status)}</span>
}
export function FormField({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return <label className="block text-sm font-medium text-slate-700">{label}{children}{error && <span className="mt-1 block text-xs text-red-700">{error}</span>}{hint && !error && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}</label>
}
export function DetailLink({ to, children = 'Xem chi tiết' }: { to: string; children?: ReactNode }) { return <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-[#1E3A5F] hover:underline">{children}<ArrowRight size={15} /></Link> }
export function Feedback({ message, kind = 'success' }: { message?: string; kind?: 'success' | 'error' }) { return message ? <p role="status" className={cn('rounded-lg px-4 py-3 text-sm', kind === 'error' ? 'border border-red-200 bg-red-50 text-red-800' : 'border border-emerald-200 bg-emerald-50 text-emerald-800')}>{message}</p> : null }
