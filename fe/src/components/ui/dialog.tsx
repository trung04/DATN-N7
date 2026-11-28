import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './button'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
type DialogContentProps = {
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  title: string
  description?: string
  layout?: 'compact' | 'workspace'
  footer?: React.ReactNode
}

export function DialogContent({ children, className, bodyClassName, title, description, layout = 'compact', footer }: DialogContentProps) {
  const workspace = layout === 'workspace'
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
    <DialogPrimitive.Content
      {...(description ? {} : { 'aria-describedby': undefined })}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-xl focus:outline-none sm:w-[calc(100%-2rem)]',
        workspace ? 'flex max-w-5xl flex-col overflow-hidden' : 'max-w-lg overflow-y-auto p-4 sm:p-6',
        className,
      )}
    >
      <div className={cn('flex shrink-0 items-start justify-between gap-3', workspace ? 'border-b border-slate-200 px-3 py-2 sm:px-5 sm:py-3' : 'mb-5')}>
        <div className="min-w-0 self-center wrap-anywhere">
          <DialogPrimitive.Title className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</DialogPrimitive.Title>
          {description && <DialogPrimitive.Description className="mt-1 text-sm text-slate-500">{description}</DialogPrimitive.Description>}
        </div>
        <DialogPrimitive.Close asChild><Button className="shrink-0" variant="ghost" size="icon" aria-label="Đóng"><X size={18} /></Button></DialogPrimitive.Close>
      </div>
      {workspace ? <>
        <div className={cn('min-h-0 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4', bodyClassName)} data-dialog-body>{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 sm:px-5 sm:py-3" data-dialog-footer>{footer}</div>}
      </> : children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
}
