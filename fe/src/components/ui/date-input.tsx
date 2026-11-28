import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/cn'
import { day } from '@/lib/utils'

type DateInputProps = {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  required?: boolean
  disabled?: boolean
}

function parseDate(text: string) {
  const input = text.trim()
  if (!input) return ''
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(input)
  const value = iso ? input : local && `${local[3]}-${local[2]!.padStart(2, '0')}-${local[1]!.padStart(2, '0')}`
  if (!value || value.startsWith('0000-')) return null
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}

function DateInput({ id, value, onChange, min, max, required, disabled }: DateInputProps & { id: string }) {
  const field = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<{ value: string; text: string }>()
  const [attempted, setAttempted] = useState(false)
  const text = draft?.value === value ? draft.text : value ? day(value) : ''
  const date = parseDate(text)
  const invalidMessage = date === null ? 'Nhập ngày hợp lệ theo dạng ngày/tháng/năm.'
    : date && min && date < min ? `Chọn ngày từ ${day(min)} trở đi.`
      : date && max && date > max ? `Chọn ngày đến ${day(max)}.` : ''

  useEffect(() => { field.current?.setCustomValidity(invalidMessage) }, [invalidMessage])

  function openCalendar() {
    if (disabled) return
    try {
      if (picker.current?.showPicker) {
        picker.current.showPicker()
        return
      }
    } catch {
      // A browser that cannot open its calendar still supports direct typing.
    }
    field.current?.focus()
  }

  return <span className="date-input">
    <input id={id} ref={field} className="date-input-value" type="text" inputMode="numeric" autoComplete="off"
      placeholder="dd/mm/yyyy" value={text} required={required} disabled={disabled}
      aria-invalid={attempted && (Boolean(invalidMessage) || (required && !date)) || undefined}
      onInvalid={() => setAttempted(true)}
      onChange={event => {
        const nextText = event.target.value
        const nextDate = parseDate(nextText)
        setDraft({ value: nextDate ?? value, text: nextText })
        if (nextDate !== null && nextDate !== value) onChange(nextDate)
      }}
      onBlur={() => {
        if (date !== null) setDraft(undefined)
        setAttempted(true)
      }}
    />
    <button type="button" className="date-input-trigger" aria-label="Mở lịch" title="Mở lịch" disabled={disabled} onClick={openCalendar}>
      <CalendarDays size={17} aria-hidden="true" />
    </button>
    <input ref={picker} className="date-input-picker" type="date" lang="vi" aria-hidden="true" tabIndex={-1}
      min={min} max={max} disabled={disabled} value={invalidMessage ? '' : date ?? ''}
      onChange={event => {
        setDraft(undefined)
        onChange(event.target.value)
      }}
    />
  </span>
}

export function DateField({ label, withTime, className, ...props }: DateInputProps & { label: ReactNode; withTime?: boolean; className?: string }) {
  const id = useId()
  return <div className={cn('min-w-0 text-sm font-medium text-slate-700', className)}>
    <label id={id + '-label'} htmlFor={id}>{label}</label>
    {withTime ? <DateTimeInput id={id} {...props} /> : <DateInput id={id} {...props} />}
  </div>
}

function DateTimeInput({ id, value, onChange, required, disabled, min, max }: DateInputProps & { id: string }) {
  const date = value.slice(0, 10)
  const time = value.slice(11, 16)
  return <div className="flex min-w-0 flex-wrap gap-x-2">
    <div className="flex-[1_1_122px]"><DateInput id={id} value={date} required={required} disabled={disabled} min={min} max={max}
      onChange={next => onChange(next ? next + 'T' + (time || '00:00') : '')} /></div>
    <div className="flex-[1_1_100px]">
      <span id={id + '-time'} className="sr-only">giờ</span>
      <input type="time" aria-labelledby={id + '-label ' + id + '-time'} lang="vi" disabled={disabled || !date} required={required || Boolean(date)}
        value={time} onChange={event => onChange(date + 'T' + event.target.value)} />
    </div>
  </div>
}
