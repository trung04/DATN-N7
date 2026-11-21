import { useEffect } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { Button } from './button'

type ToastProps = { message: string; kind: 'success' | 'error'; onClose: () => void; duration?: number; placement?: 'top' | 'bottom' }

export function Toast({ message, kind, onClose, duration = 4000, placement = 'top' }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timer)
  }, [duration, onClose])

  const success = kind === 'success'
  return <div role={success ? 'status' : 'alert'} className={'fixed right-4 z-[80] flex max-w-[min(28rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-xl ' + (placement === 'bottom' ? 'bottom-16' : 'top-20') + ' ' + (success ? 'border-emerald-200 text-emerald-900' : 'border-red-200 text-red-900')}>
    {success ? <CircleCheck className="mt-0.5 shrink-0 text-emerald-600" size={18} /> : <CircleAlert className="mt-0.5 shrink-0 text-red-600" size={18} />}
    <span className="min-w-0 flex-1 leading-5">{message}</span>
    <Button type="button" size="icon" variant="ghost" className="-mr-2 -mt-1 h-7 w-7 shrink-0" aria-label="Đóng thông báo" onClick={onClose}><X size={14} /></Button>
  </div>
}
