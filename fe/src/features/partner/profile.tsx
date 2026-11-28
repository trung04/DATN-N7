import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { api } from '@/services/api/client'
import { DomainError } from '@/lib/errors'
import { errorMessage } from '@/lib/utils'
import { useSession } from '@/stores/session'
import type { HotelOwnerProfile } from '@/types/domain'
import { BankPicker } from './bank-picker'

type BankForm = { bankBin: string; bankAccountNumber: string; bankAccountHolder: string }

const accountPattern = /^[0-9]{4,24}$/

export function PartnerProfilePage() {
  const userId = useSession(state => state.user?.id)
  const client = useQueryClient()
  const profileKey = ['partner-owner-profile', userId] as const
  const profile = useQuery({ queryKey: profileKey, queryFn: () => api.hotelOwnerProfile(userId!), enabled: Boolean(userId) })
  const banks = useQuery({ queryKey: ['hotel-owner-banks'], queryFn: api.hotelOwnerBanks, staleTime: 300_000 })
  const [draft, setDraft] = useState<BankForm | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  if (profile.isPending || banks.isPending) return <LoadingState />
  if (profile.isError) return <ErrorState message={profile.error instanceof DomainError && profile.error.status === 404 ? 'Chưa có hồ sơ chủ khách sạn. Vui lòng liên hệ quản trị viên để tạo hồ sơ.' : errorMessage(profile.error)} retry={() => { void profile.refetch() }} />
  if (banks.isError) return <ErrorState message="Không tải được danh sách ngân hàng." retry={() => { void banks.refetch() }} />

  const saved = {
    bankBin: profile.data.bankBin ?? '',
    bankAccountNumber: profile.data.bankAccountNumber ?? '',
    bankAccountHolder: profile.data.bankAccountHolder ?? '',
  }
  const form = draft ?? saved
  const bank = banks.data.find(option => option.bin === form.bankBin)
  const hasChanges = form.bankBin !== saved.bankBin || form.bankAccountNumber !== saved.bankAccountNumber || form.bankAccountHolder !== saved.bankAccountHolder
  const invalidAccount = Boolean(form.bankAccountNumber) && !accountPattern.test(form.bankAccountNumber)
  const demoHolder = /^DEMO ONLY - HOST /i.test(form.bankAccountHolder.trim())

  function update(key: keyof BankForm, value: string) {
    setError('')
    setNotice('')
    setDraft(current => ({ ...(current ?? saved), [key]: value }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (!bank) { setError('Hãy chọn ngân hàng nhận tiền.'); return }
    if (!form.bankAccountHolder.trim() || demoHolder) { setError('Hãy nhập tên chủ tài khoản đăng ký với ngân hàng.'); return }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await api.updateHotelOwnerProfile(userId!, {
        bankBin: bank.bin,
        bankAccountNumber: form.bankAccountNumber,
        bankAccountHolder: form.bankAccountHolder.trim(),
      })
      client.setQueryData<HotelOwnerProfile>(profileKey, updated)
      setDraft(null)
      setNotice('Đã lưu thông tin tài khoản nhận tiền.')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return <div className="min-w-0">
    <PageHeader title="Thông tin thanh toán" description="Quản lý tài khoản ngân hàng nhận tiền đối soát của khách sạn." />
    <div className="grid max-w-6xl min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(240px,1fr)]">
      <Card className="min-w-0 p-4 sm:p-5">
        <form className="grid gap-4" onSubmit={save}>
          <fieldset disabled={busy} className="grid min-w-0 gap-4">
            <BankPicker banks={banks.data} selected={bank} onSelect={option => update('bankBin', option.bin)} />
            <div className="grid items-start gap-4 md:grid-cols-2">
              <FormField label="Số tài khoản" hint="Nhập từ 4 đến 24 chữ số.">
                <input required type="text" inputMode="numeric" pattern="[0-9]{4,24}" maxLength={24} autoComplete="off"
                  placeholder="Nhập số tài khoản" value={form.bankAccountNumber}
                  onChange={event => update('bankAccountNumber', event.target.value.trim())} />
              </FormField>
              <FormField label="Tên chủ tài khoản">
                <input required maxLength={150} autoComplete="off" placeholder="Tên đăng ký với ngân hàng"
                  value={form.bankAccountHolder} onChange={event => update('bankAccountHolder', event.target.value)} />
              </FormField>
            </div>
          </fieldset>
          {(invalidAccount || demoHolder) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {invalidAccount && demoHolder ? 'Hồ sơ đang dùng thông tin mẫu. Hãy cập nhật số tài khoản và tên chủ tài khoản.' : demoHolder
              ? 'Hãy thay tên chủ tài khoản mẫu bằng tên đăng ký với ngân hàng.'
              : 'Số tài khoản hiện tại chưa hợp lệ. Hãy nhập số tài khoản ngân hàng để nhận tiền.'}
          </p>}
          <Feedback message={error} kind="error" />
          <Feedback message={notice} />
          <div className="flex justify-end border-t border-slate-200 pt-3">
            <Button type="submit" className="w-full sm:w-auto" disabled={busy || !hasChanges}>
              <Save size={16} aria-hidden="true" />{busy ? 'Đang lưu…' : 'Lưu thông tin'}
            </Button>
          </div>
        </form>
      </Card>
      <aside className="min-w-0 rounded-xl border border-[#2B496B] bg-[#1E3A5F] p-4 text-white shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2"><Landmark size={19} aria-hidden="true" /><h2 className="font-semibold">Tài khoản nhận tiền</h2></div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
          <div>
            <dt className="text-slate-300">Ngân hàng</dt>
            <dd className="mt-0.5 font-semibold wrap-anywhere">{bank?.shortName ?? 'Chưa chọn ngân hàng'}</dd>
          </div>
          <div>
            <dt className="text-slate-300">Số tài khoản</dt>
            <dd className="mt-0.5 font-mono font-semibold wrap-anywhere">{accountPattern.test(form.bankAccountNumber) ? form.bankAccountNumber : '—'}</dd>
          </div>
          <div className="sm:col-span-2 xl:col-span-1">
            <dt className="text-slate-300">Chủ tài khoản</dt>
            <dd className="mt-0.5 font-semibold wrap-anywhere">{demoHolder ? '—' : form.bankAccountHolder.trim() || '—'}</dd>
          </div>
        </dl>
      </aside>
    </div>
  </div>
}
