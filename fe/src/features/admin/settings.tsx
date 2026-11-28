import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowLeft, Banknote, Bot, Building2, CreditCard, Database, Hotel, KeyRound, Mail, MapPinned, Percent, RotateCcw, Settings2 } from 'lucide-react'
import { Card, ErrorState, Feedback, LoadingState, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { dateTime, errorMessage } from '@/lib/utils'
import { mapSettingsQueryKey } from '@/lib/use-mapbox-token'
import { api } from '@/services/api/client'
import type { PlatformSettingSection, PlatformSettingValue } from '@/types/domain'

const settingsKey = ['admin-booking-settings'] as const
const integrationsKey = ['admin-platform-settings'] as const
const formatRate = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const sections = [
  { id: 'commission', label: 'Hoa hồng', icon: Percent },
  { id: 'booking', label: 'Giữ phòng', icon: Hotel },
  { id: 'refunds', label: 'Hoàn tiền', icon: RotateCcw },
  { id: 'payos-collection', label: 'payOS thu tiền', icon: CreditCard },
  { id: 'payos-payout', label: 'payOS chi tiền', icon: Banknote },
  { id: 'google', label: 'Google', icon: KeyRound },
  { id: 'email-connection', label: 'Kết nối thư điện tử', icon: Mail },
  { id: 'email-account', label: 'Tài khoản thư điện tử', icon: Building2 },
  { id: 'map', label: 'Bản đồ', icon: MapPinned },
  { id: 'ai', label: 'Dịch vụ AI', icon: Bot },
  { id: 'storage', label: 'Lưu trữ ảnh', icon: Database },
]

export function AdminSettingsPage() {
  const [selected, setSelected] = useState('commission')
  const integrations = useQuery({ queryKey: integrationsKey, queryFn: api.platformSettings, enabled: selected !== 'commission' })
  const active = integrations.data?.find(section => section.section === selected)
  return <div className="min-w-0">
    <PageHeader title="Cấu hình" description="Thiết lập đặt phòng và quản lý kết nối dịch vụ." />
    <div className="grid min-w-0 gap-3 md:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-4">
      <Card className="self-start p-2">
        <div className="flex items-center gap-2 md:hidden">
          <Link to="/admin" className="inline-flex shrink-0 items-center gap-1 px-1 text-sm font-medium text-[#1E3A5F]"><ArrowLeft size={15} /> Quản trị</Link>
          <label className="sr-only" htmlFor="settings-section">Nhóm cấu hình</label>
          <select id="settings-section" value={selected} onChange={event => setSelected(event.target.value)} className="m-0! min-h-9! min-w-0">
            {sections.map(section => <option value={section.id} key={section.id}>{section.label}</option>)}
          </select>
        </div>
        <nav aria-label="Nhóm cấu hình" className="hidden gap-0.5 md:grid">
          {sections.map(({ id, label, icon: Icon }) => <button key={id} type="button"
            aria-current={selected === id ? 'page' : undefined}
            onClick={() => setSelected(id)}
            className={`flex min-h-8 items-center gap-2 rounded-md px-2 py-1 text-left text-sm font-medium ${selected === id ? 'bg-[#e8eef5] text-[#1E3A5F]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Icon size={15} aria-hidden="true" />{label}
          </button>)}
        </nav>
      </Card>
      {selected === 'commission' ? <CommissionSettings /> : active ? <IntegrationSettings key={active.section} section={active} />
        : integrations.isError ? <ErrorState message={errorMessage(integrations.error)} retry={() => { void integrations.refetch() }} />
          : <LoadingState label="Đang tải cấu hình…" />}
    </div>
  </div>
}

function CommissionSettings() {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: settingsKey, queryFn: api.bookingSettings })
  const [draft, setDraft] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: api.saveBookingSettings,
    onSuccess: updated => {
      queryClient.setQueryData(settingsKey, updated)
      setDraft(null)
    },
  })
  const current = settings.data
  const input = draft ?? (current ? formatRate.format(current.commissionRate) : '')
  const parsed = Number(input.replace(',', '.'))
  const valid = /^\d+(?:[.,]\d{1,2})?$/.test(input) && parsed >= 0 && parsed <= 100

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (valid && current && parsed !== current.commissionRate && !save.isPending) save.mutate(parsed)
  }

  return <div>
    {settings.isPending && <LoadingState label="Đang tải cấu hình…" />}
    {settings.isError && !current && <ErrorState message={errorMessage(settings.error)} retry={() => { void settings.refetch() }} />}
    {current && <Card className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-200/60 text-[#1E3A5F]">
          <Percent size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Hoa hồng đặt phòng</h2>
          <p className="mt-1 text-sm text-slate-600">Tỷ lệ hoa hồng trên tiền phòng khi đối soát với khách sạn.</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-slate-600">
          <span>Đang áp dụng</span>
          <strong className="text-lg font-semibold text-[#1E3A5F]">{formatRate.format(current.commissionRate)}%</strong>
          {current.updatedAt && <time className="text-xs" dateTime={current.updatedAt}>Cập nhật {dateTime(current.updatedAt)}</time>}
        </div>
        <div className="max-w-xs">
          <label htmlFor="booking-commission-rate" className="text-sm font-medium text-slate-800">Tỷ lệ hoa hồng (%)</label>
          <input id="booking-commission-rate" inputMode="decimal" value={input} disabled={save.isPending} required
            aria-describedby="booking-commission-hint" aria-invalid={draft !== null && !valid}
            onChange={event => { save.reset(); setDraft(event.target.value.trim()) }} />
          <p id="booking-commission-hint" className={`mt-1 text-xs ${draft !== null && !valid ? 'text-red-700' : 'text-slate-600'}`}>
            Từ 0% đến 100%, tối đa 2 chữ số thập phân.
          </p>
        </div>
        <p className="text-sm text-slate-600">Mức mới áp dụng cho đơn đặt phòng tạo sau khi lưu. Đối soát dùng tỷ lệ đã lưu trên từng đơn đặt phòng.</p>
        <Feedback message={save.isError ? errorMessage(save.error) : save.isSuccess ? 'Đã lưu tỷ lệ hoa hồng.' : undefined} kind={save.isError ? 'error' : 'success'} />
        <Button disabled={!valid || parsed === current.commissionRate || save.isPending}>
          {save.isPending ? 'Đang lưu…' : 'Lưu cấu hình'}
        </Button>
      </form>
    </Card>}
  </div>
}

function IntegrationSettings({ section }: { section: PlatformSettingSection }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Record<string, string | boolean>>({})
  const [revision, setRevision] = useState<number | null>(null)
  const save = useMutation({
    mutationFn: (values: Record<string, PlatformSettingValue>) => api.savePlatformSettings(section.section, revision ?? section.revision, values),
    onSuccess: async updated => {
      queryClient.setQueryData<PlatformSettingSection[]>(integrationsKey, current =>
        current?.map(item => item.section === updated.section ? updated : item))
      setDraft({})
      setRevision(null)
      if (section.section === 'map') await queryClient.invalidateQueries({ queryKey: mapSettingsQueryKey })
    },
  })
  const readOnly = section.fields.every(field => field.readOnly)
  const outdated = revision !== null && revision !== section.revision
  const values: Record<string, PlatformSettingValue> = {}
  for (const field of section.fields) {
    const value = draft[field.key]
    if (value === undefined || field.readOnly || (field.kind === 'secret' && !String(value).trim())) continue
    values[field.key] = field.kind === 'number' ? Number(value) : value
  }

  function update(key: string, value: string | boolean) {
    save.reset()
    setRevision(revision ?? section.revision)
    setDraft(previous => ({ ...previous, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!save.isPending && !outdated && Object.keys(values).length) save.mutate(values)
  }

  function reload() {
    save.reset()
    setDraft({})
    setRevision(null)
    void queryClient.invalidateQueries({ queryKey: integrationsKey })
  }

  return <Card className="min-w-0 self-start overflow-hidden">
    <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-200/60 text-[#1E3A5F]">
        <Settings2 size={18} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h2 className="font-semibold text-slate-900">{section.label}</h2>
        <p className="mt-0.5 text-sm text-slate-600">{section.description}</p>
      </div>
    </div>
    <form onSubmit={submit} autoComplete="off" className="space-y-2 p-3 sm:space-y-3 sm:p-5">
      <div className="grid min-w-0 gap-x-4 gap-y-2 sm:grid-cols-2">
        {section.fields.map(field => {
          const id = `platform-${field.key}`
          if (field.readOnly) {
            const summary = field.kind === 'secret' ? field.configured ? 'Đã cấu hình' : 'Chưa cấu hình' : field.value ?? 'Chưa cấu hình'
            return <div key={field.key} className="min-w-0 rounded-md bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs font-medium text-slate-600">{field.label}</p>
              <p className="truncate font-medium text-slate-900" title={String(summary)}>{String(summary || 'Chưa cấu hình')}</p>
            </div>
          }
          if (field.kind === 'boolean') return <label key={field.key} className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800">
            <input type="checkbox" className="m-0! size-4! min-h-0! shrink-0 accent-[#1E3A5F]" checked={Boolean(draft[field.key] ?? field.value)}
              disabled={save.isPending} onChange={event => update(field.key, event.target.checked)} />{field.label}
          </label>
          return <div key={field.key} className="min-w-0">
            <label htmlFor={id} className="flex items-center justify-between gap-2 text-sm font-medium text-slate-800">
              {field.label}
              {field.kind === 'secret' && <span className="text-xs font-normal text-slate-500">{field.configured ? 'Đã cấu hình' : 'Chưa cấu hình'}</span>}
            </label>
            <input id={id} type={field.kind === 'secret' ? 'password' : field.kind === 'number' ? 'number' : 'text'}
              value={String(draft[field.key] ?? field.value ?? '')} disabled={save.isPending}
              min={field.min} max={field.max} required={field.kind === 'number'} maxLength={2048}
              placeholder={field.kind === 'secret' && field.configured ? 'Nhập giá trị mới để thay' : undefined}
              autoComplete={field.kind === 'secret' ? 'new-password' : 'off'} onChange={event => update(field.key, event.target.value)} />
          </div>
        })}
      </div>
      {outdated && <Feedback kind="error" message="Cấu hình đã thay đổi trong phiên khác. Hãy tải lại." />}
      {save.isError && <Feedback kind="error" message={errorMessage(save.error)} />}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {!readOnly && <Button disabled={!Object.keys(values).length || save.isPending || outdated}>
          {save.isPending ? 'Đang lưu…' : 'Lưu cấu hình'}
        </Button>}
        {(outdated || save.isError) && <Button type="button" variant="secondary" onClick={reload}>Tải lại</Button>}
        {save.isSuccess && <span role="status" className="text-sm font-medium text-emerald-800">Đã lưu cấu hình.</span>}
        {section.updatedAt && <time dateTime={section.updatedAt} className="hidden text-xs text-slate-500 sm:inline">Cập nhật {dateTime(section.updatedAt)}</time>}
      </div>
    </form>
  </Card>
}
