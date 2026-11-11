import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { api } from '@/services/api/client'
import { DomainError } from '@/lib/errors'
import { errorMessage } from '@/lib/utils'
import { useSession } from '@/stores/session'

export function PartnerProfilePage() {
  const user = useSession(state => state.user)
  const client = useQueryClient()
  const profile = useQuery({ queryKey: ['partner-owner-profile', user?.id], queryFn: () => api.hotelOwnerProfile(user!.id), enabled: Boolean(user?.id) })
  const [draft, setDraft] = useState<{ bankName: string; bankAccountNumber: string; bankAccountHolder: string } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const form = draft ?? { bankName: profile.data?.bankName ?? '', bankAccountNumber: profile.data?.bankAccountNumber ?? '', bankAccountHolder: profile.data?.bankAccountHolder ?? '' }
  const update = (key: keyof typeof form, value: string) => setDraft(current => ({ ...(current ?? form), [key]: value }))
  if (profile.isPending) return <LoadingState />
  if (profile.isError) return <ErrorState message={profile.error instanceof DomainError && profile.error.status === 404 ? 'Chưa có hồ sơ chủ khách sạn. Vui lòng liên hệ quản trị viên để tạo hồ sơ.' : errorMessage(profile.error)} retry={() => { void profile.refetch() }} />
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await api.updateHotelOwnerProfile(user!.id, { bankName: form.bankName.trim() || null, bankAccountNumber: form.bankAccountNumber.trim() || null, bankAccountHolder: form.bankAccountHolder.trim() || null })
      setDraft(null); setNotice('Đã cập nhật thông tin thanh toán.')
      await client.invalidateQueries({ queryKey: ['partner-owner-profile', user?.id] })
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  return <div><PageHeader title="Thông tin thanh toán" description="Cập nhật thông tin tài khoản nhận thanh toán của khách sạn." /><Card className="max-w-2xl p-6"><form className="grid gap-4" onSubmit={save}>
    <FormField label="Tên ngân hàng"><input maxLength={150} value={form.bankName} onChange={event => update('bankName', event.target.value)} /></FormField>
    <FormField label="Số tài khoản"><input maxLength={50} value={form.bankAccountNumber} onChange={event => update('bankAccountNumber', event.target.value)} /></FormField>
    <FormField label="Tên chủ tài khoản"><input maxLength={150} value={form.bankAccountHolder} onChange={event => update('bankAccountHolder', event.target.value)} /></FormField>
    <Feedback message={error} kind="error" /><Feedback message={notice} /><Button disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu thông tin'}</Button>
  </form></Card></div>
}
