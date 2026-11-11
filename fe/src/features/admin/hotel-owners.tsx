import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { api } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'
import type { AdminUserQuery, HotelOwnerProfile } from '@/types/domain'

const userQuery: AdminUserQuery = { page: 1, limit: 100, role: 'HOTEL_OWNER', sortBy: 'username', sortOrder: 'ASC' }
const blankProfile = { bankName: '', bankAccountNumber: '', bankAccountHolder: '' }

export function AdminHotelOwnersPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const search = params.get('q')?.trim() ?? ''
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<HotelOwnerProfile | null>(null)
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<HotelOwnerProfile | null>(null)
  const [userId, setUserId] = useState('')
  const [fields, setFields] = useState(blankProfile)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const ownerQuery = useQuery({ queryKey: ['admin-hotel-owners', page, search], queryFn: () => api.hotelOwners(page, 20, search) })
  const usersQuery = useQuery({ queryKey: ['admin-hotel-owner-users', search], queryFn: () => api.adminUsers({ ...userQuery, ...(search ? { search } : {}) }) })
  const owners = ownerQuery.data?.data ?? []
  const users = usersQuery.data?.data ?? []
  const userById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])
  const unprofiled = users.filter(user => !owners.some(owner => owner.userId === user.id))
  const setSearch = (value: string) => { const next = new URLSearchParams(params); if (value) next.set('q', value); else next.delete('q'); next.delete('page'); setParams(next, { replace: true }) }
  const openCreate = () => { setCreating(true); setEditing(null); setUserId(unprofiled[0]?.id ?? ''); setFields(blankProfile); setError('') }
  const openEdit = (owner: HotelOwnerProfile) => { setCreating(false); setEditing(owner); setUserId(owner.userId); setFields({ bankName: owner.bankName ?? '', bankAccountNumber: owner.bankAccountNumber ?? '', bankAccountHolder: owner.bankAccountHolder ?? '' }); setError('') }
  const refresh = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-hotel-owners'] }), queryClient.invalidateQueries({ queryKey: ['admin-hotel-owner-users'] })]) }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('')
    const body = { bankName: fields.bankName.trim() || null, bankAccountNumber: fields.bankAccountNumber.trim() || null, bankAccountHolder: fields.bankAccountHolder.trim() || null }
    try {
      if (editing) await api.updateHotelOwnerProfile(editing.userId, body)
      else await api.createHotelOwnerProfile({ userId, ...body })
      await refresh(); setCreating(false); setEditing(null); setNotice(editing ? 'Đã cập nhật hồ sơ chủ khách sạn.' : 'Đã tạo hồ sơ chủ khách sạn.')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!removing) return
    setBusy(true); setError('')
    try { await api.deleteHotelOwnerProfile(removing.userId); await refresh(); setRemoving(null); setNotice('Đã xóa hồ sơ chủ khách sạn.') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  if (ownerQuery.isPending || usersQuery.isPending) return <LoadingState />
  if (ownerQuery.isError) return <ErrorState message={errorMessage(ownerQuery.error)} retry={() => { void ownerQuery.refetch() }} />
  if (usersQuery.isError) return <ErrorState message={errorMessage(usersQuery.error)} retry={() => { void usersQuery.refetch() }} />
  const pages = Math.max(1, Math.ceil((ownerQuery.data?.meta.total ?? 0) / 20))
  return <div>
    <PageHeader title="Hồ sơ chủ khách sạn" description="Quản lý thông tin thanh toán của các tài khoản có vai trò chủ khách sạn." actions={<Button onClick={openCreate} disabled={!unprofiled.length}><Plus size={16} />Tạo hồ sơ</Button>} />
    <div className="mb-4 max-w-lg"><FormField label="Tìm theo tài khoản hoặc tên"><span className="relative block"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="!pl-9" value={params.get('q') ?? ''} onChange={event => setSearch(event.target.value)} placeholder="Username, email, tên" /></span></FormField></div>
    <Feedback message={notice} />
    {owners.length ? <>
      <Card className="table-scroll"><table><thead><tr><th>Chủ khách sạn</th><th>Ngân hàng</th><th>Chủ tài khoản</th><th>Số tài khoản</th><th>Thao tác</th></tr></thead><tbody>{owners.map(owner => { const user = userById.get(owner.userId); return <tr key={owner.userId}><td><strong>{user?.displayName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || owner.userId}</strong><span className="block text-xs text-slate-500">{user?.email ?? owner.userId}</span></td><td>{owner.bankName || 'Chưa cập nhật'}</td><td>{owner.bankAccountHolder || '—'}</td><td>{owner.bankAccountNumber ? `••••${owner.bankAccountNumber.slice(-4)}` : '—'}</td><td><div className="flex gap-3"><button className="font-semibold text-[#1E3A5F]" onClick={() => openEdit(owner)}>Chỉnh sửa</button><button className="text-red-700" aria-label="Xóa hồ sơ" onClick={() => { setRemoving(owner); setError('') }}><Trash2 size={16} /></button></div></td></tr> })}</tbody></table></Card>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-600"><span>{ownerQuery.data?.meta.total} hồ sơ · Trang {page}/{pages}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page - 1)); setParams(next, { replace: true }) }}>Trước</Button><Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page + 1)); setParams(next, { replace: true }) }}>Sau</Button></div></div>
    </> : <EmptyState title="Chưa có hồ sơ chủ khách sạn" description="Tạo hồ sơ cho tài khoản đã có vai trò chủ khách sạn." action={<Button onClick={openCreate} disabled={!unprofiled.length}><Plus size={16} />Tạo hồ sơ</Button>} />}
    <Dialog open={creating || Boolean(editing)} onOpenChange={open => { if (!open) { setCreating(false); setEditing(null) } }}><DialogContent title={editing ? 'Cập nhật hồ sơ chủ khách sạn' : 'Tạo hồ sơ chủ khách sạn'}><form className="grid gap-4" onSubmit={save}>
      {creating && <FormField label="Tài khoản chủ khách sạn"><select required value={userId} onChange={event => setUserId(event.target.value)}>{unprofiled.map(user => <option key={user.id} value={user.id}>{user.displayName || user.username} · {user.email}</option>)}</select></FormField>}
      <FormField label="Tên ngân hàng"><input maxLength={150} value={fields.bankName} onChange={event => setFields(current => ({ ...current, bankName: event.target.value }))} /></FormField><FormField label="Số tài khoản"><input maxLength={50} value={fields.bankAccountNumber} onChange={event => setFields(current => ({ ...current, bankAccountNumber: event.target.value }))} /></FormField><FormField label="Tên chủ tài khoản"><input maxLength={150} value={fields.bankAccountHolder} onChange={event => setFields(current => ({ ...current, bankAccountHolder: event.target.value }))} /></FormField><Feedback message={error} kind="error" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null) }}>Hủy</Button><Button disabled={busy || (creating && !userId)}>{busy ? 'Đang lưu...' : 'Lưu hồ sơ'}</Button></div>
    </form></DialogContent></Dialog>
    <Dialog open={Boolean(removing)} onOpenChange={open => { if (!open) setRemoving(null) }}><DialogContent title="Xóa hồ sơ chủ khách sạn?" description="Thao tác này chỉ xóa thông tin hồ sơ thanh toán."><Feedback message={error} kind="error" /><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setRemoving(null)}>Hủy</Button><Button variant="danger" disabled={busy} onClick={() => { void remove() }}>{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</Button></div></DialogContent></Dialog>
  </div>
}
