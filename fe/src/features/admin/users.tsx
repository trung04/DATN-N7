import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownUp, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { api } from '@/services/api/client'
import { day, errorMessage } from '@/lib/utils'
import type { AdminUser, AdminUserGender, AdminUserQuery, AdminUserRole, AdminUserStatus, CreateAdminUserInput, UpdateAdminUserInput } from '@/types/domain'
import { useSearchParams } from 'react-router'

type UserForm = {
  username: string; email: string; password: string; firstName: string; lastName: string; displayName: string
  phoneNumber: string; dateOfBirth: string; gender: AdminUserGender | ''; status: AdminUserStatus; role: AdminUserRole
}
const emptyForm: UserForm = { username: '', email: '', password: '', firstName: '', lastName: '', displayName: '', phoneNumber: '', dateOfBirth: '', gender: '', status: 'ACTIVE', role: 'TOURIST' }
const statusLabel: Record<AdminUserStatus, string> = { ACTIVE: 'Hoạt động', INACTIVE: 'Không hoạt động', SUSPENDED: 'Đã khóa', DEACTIVATED: 'Đã vô hiệu hóa' }
const roleLabel: Record<AdminUserRole, string> = { TOURIST: 'Du khách', HOTEL_OWNER: 'Đối tác khách sạn', ADMIN: 'Quản trị viên' }
const genderLabel: Record<AdminUserGender, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác', UNDISCLOSED: 'Không tiết lộ' }
const sortFields: AdminUserQuery['sortBy'][] = ['createdAt', 'updatedAt', 'username', 'email', 'displayName']

function queryFrom(params: URLSearchParams): AdminUserQuery {
  const sortBy = params.get('sortBy') as AdminUserQuery['sortBy'] | null
  const verified = params.get('verified')
  const query: AdminUserQuery = {
    page: Math.max(1, Number(params.get('page')) || 1), limit: 20,
    sortBy: sortFields.includes(sortBy as AdminUserQuery['sortBy']) ? sortBy as AdminUserQuery['sortBy'] : 'createdAt',
    sortOrder: params.get('sortOrder') === 'ASC' ? 'ASC' : 'DESC',
  }
  const search = params.get('q')?.trim()
  const status = params.get('status') as AdminUserStatus | null
  const role = params.get('role') as AdminUserRole | null
  const gender = params.get('gender') as AdminUserGender | null
  if (search) query.search = search
  if (status && Object.hasOwn(statusLabel, status)) query.status = status
  if (role && Object.hasOwn(roleLabel, role)) query.role = role
  if (gender && Object.hasOwn(genderLabel, gender)) query.gender = gender
  if (verified === 'true' || verified === 'false') query.isEmailVerified = verified === 'true'
  return query
}

function toForm(user?: AdminUser): UserForm {
  if (!user) return { ...emptyForm }
  return { username: user.username, email: user.email, password: '', firstName: user.firstName ?? '', lastName: user.lastName ?? '', displayName: user.displayName ?? '', phoneNumber: user.phoneNumber ?? '', dateOfBirth: user.dateOfBirth ?? '', gender: user.gender ?? '', status: user.status, role: user.role }
}

export function AdminUsersPage() {
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => queryFrom(params), [params])
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<'create' | 'detail' | 'edit' | 'password' | 'delete' | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<UserForm>({ ...emptyForm })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useQuery({ queryKey: ['admin-users', query], queryFn: () => api.adminUsers(query) })
  const detail = useQuery({ queryKey: ['admin-user', selectedId], queryFn: () => api.adminUser(selectedId), enabled: Boolean(selectedId) && ['detail', 'edit', 'password', 'delete'].includes(dialog ?? '') })
  const users = list.data?.data ?? []
  const pageCount = Math.max(1, Math.ceil((list.data?.meta.total ?? 0) / query.limit))

  const setFilter = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (resetPage) next.delete('page')
    setParams(next)
  }
  const openCreate = () => { setSelectedId(''); setSelectedUser(null); setForm({ ...emptyForm }); setFormError(''); setDialog('create') }
  const openUser = (user: AdminUser, mode: 'detail' | 'edit' | 'password' | 'delete') => {
    setSelectedId(user.id); setSelectedUser(user); setForm(toForm(user)); setFormError(''); setNotice(''); setNewPassword(''); setConfirmPassword(''); setDialog(mode)
  }
  const closeDialog = (open: boolean) => { if (!open && !busy) { setDialog(null); setFormError('') } }
  const changeForm = <K extends keyof UserForm>(key: K, value: UserForm[K]) => setForm(current => ({ ...current, [key]: value }))
  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setFormError('')
    try {
      if (dialog === 'create') {
        const payload: CreateAdminUserInput = {
          username: form.username.trim(), email: form.email.trim(), password: form.password,
          firstName: form.firstName.trim() || null, lastName: form.lastName.trim() || null,
          displayName: form.displayName.trim() || null, phoneNumber: form.phoneNumber.trim() || null,
          dateOfBirth: form.dateOfBirth || null, gender: form.gender || null, status: form.status,
        }
        await api.createAdminUser(payload)
        setNotice('Đã tạo tài khoản.')
      } else {
        const payload: UpdateAdminUserInput = {
          username: form.username.trim(), email: form.email.trim(), firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null, displayName: form.displayName.trim() || null,
          phoneNumber: form.phoneNumber.trim() || null, dateOfBirth: form.dateOfBirth || null,
          gender: form.gender || null, status: form.status, role: form.role,
        }
        await api.updateAdminUser(selectedId, payload)
        setNotice('Đã cập nhật tài khoản.')
      }
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-users'] }), queryClient.invalidateQueries({ queryKey: ['admin-user', selectedId] }), queryClient.invalidateQueries({ queryKey: ['admin'] })])
      setDialog(null)
    } catch (error) { setFormError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError('')
    if (newPassword !== confirmPassword) { setFormError('Mật khẩu xác nhận không khớp.'); return }
    setBusy(true)
    try {
      await api.resetAdminUserPassword(selectedId, newPassword)
      setDialog(null); setNotice('Đã đặt lại mật khẩu.')
      await queryClient.invalidateQueries({ queryKey: ['admin-user', selectedId] })
    } catch (error) { setFormError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const deleteUser = async () => {
    setBusy(true); setFormError('')
    try {
      await api.deleteAdminUser(selectedId); setDialog(null); setNotice('Đã xóa tài khoản.')
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-users'] }), queryClient.invalidateQueries({ queryKey: ['admin'] })])
    } catch (error) { setFormError(errorMessage(error)) }
    finally { setBusy(false) }
  }

  if (list.isPending) return <LoadingState />
  if (list.isError) return <ErrorState message={errorMessage(list.error)} retry={() => { void list.refetch() }} />

  return <div>
    <PageHeader title="Quản lý người dùng" description="Tìm kiếm tài khoản, cập nhật quyền truy cập và quản lý thông tin người dùng." actions={<Button onClick={openCreate}><Plus size={17} />Tạo tài khoản</Button>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <FormField label="Tìm username, tên hoặc email"><span className="relative block"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="!pl-9" value={params.get('q') ?? ''} onChange={event => setFilter('q', event.target.value)} placeholder="Nhập từ khóa" /></span></FormField>
      <FormField label="Trạng thái"><select value={params.get('status') ?? ''} onChange={event => setFilter('status', event.target.value)}><option value="">Tất cả</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
      <FormField label="Vai trò"><select value={params.get('role') ?? ''} onChange={event => setFilter('role', event.target.value)}><option value="">Tất cả</option>{Object.entries(roleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
      <FormField label="Giới tính"><select value={params.get('gender') ?? ''} onChange={event => setFilter('gender', event.target.value)}><option value="">Tất cả</option>{Object.entries(genderLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
      <FormField label="Email"><select value={params.get('verified') ?? ''} onChange={event => setFilter('verified', event.target.value)}><option value="">Tất cả</option><option value="true">Đã xác minh</option><option value="false">Chưa xác minh</option></select></FormField>
      <FormField label="Sắp xếp"><span className="relative block"><ArrowDownUp className="absolute left-3 top-3 text-slate-400" size={16} /><select className="!pl-9" value={`${query.sortBy}:${query.sortOrder}`} onChange={event => { const [field, order] = event.target.value.split(':'); const next = new URLSearchParams(params); next.set('sortBy', field ?? 'createdAt'); next.set('sortOrder', order ?? 'DESC'); next.delete('page'); setParams(next) }}>{sortFields.map(field => <option key={field} value={`${field}:${query.sortOrder}`}>{({ createdAt: 'Ngày tạo', updatedAt: 'Ngày cập nhật', username: 'Username', email: 'Email', displayName: 'Tên hiển thị' })[field]} · {query.sortOrder === 'DESC' ? 'giảm dần' : 'tăng dần'}</option>)}</select><button type="button" className="absolute right-3 top-2.5 text-xs font-semibold text-[#1E3A5F]" onClick={() => setFilter('sortOrder', query.sortOrder === 'DESC' ? 'ASC' : 'DESC', false)} aria-label="Đổi chiều sắp xếp">Đổi chiều</button></span></FormField>
    </div>
    {notice && <div className="mb-4"><Feedback message={notice} /></div>}
    {users.length ? <>
      <Card className="table-scroll"><table><thead><tr><th>Tài khoản</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Xác minh email</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>{users.map(user => <tr key={user.id}>
        <td><button className="text-left font-semibold text-[#1E3A5F] hover:underline" onClick={() => openUser(user, 'detail')}>{user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username}</button><span className="block text-xs text-slate-500">@{user.username}</span></td>
        <td>{user.email}</td><td>{roleLabel[user.role]}</td><td><StatusBadge status={user.status} /><span className="sr-only">{statusLabel[user.status]}</span></td><td>{user.isEmailVerified ? 'Đã xác minh' : 'Chưa xác minh'}</td><td>{day(user.createdAt.slice(0, 10))}</td>
        <td><div className="flex flex-wrap gap-1"><Button size="sm" variant="secondary" onClick={() => openUser(user, 'edit')}>Sửa</Button><Button size="sm" variant="secondary" aria-label={`Đặt lại mật khẩu ${user.username}`} onClick={() => openUser(user, 'password')}><RotateCcw size={15} />Mật khẩu</Button><Button size="sm" variant="danger" aria-label={`Xóa ${user.username}`} onClick={() => openUser(user, 'delete')}><Trash2 size={15} /></Button></div></td>
      </tr>)}</tbody></table></Card>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>{list.data.meta.total} tài khoản · Trang {query.page}/{pageCount}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={query.page <= 1} onClick={() => setFilter('page', String(query.page - 1), false)}>Trước</Button><Button size="sm" variant="secondary" disabled={query.page >= pageCount} onClick={() => setFilter('page', String(query.page + 1), false)}>Sau</Button></div></div>
    </> : <EmptyState title="Không có người dùng phù hợp" description="Thử thay đổi bộ lọc hoặc tạo tài khoản mới." action={<Button onClick={openCreate}><Plus size={16} />Tạo tài khoản</Button>} />}

    <Dialog open={dialog === 'create' || dialog === 'edit'} onOpenChange={closeDialog}><DialogContent title={dialog === 'create' ? 'Tạo tài khoản người dùng' : 'Chỉnh sửa tài khoản'} description={dialog === 'create' ? 'Tài khoản mới được tạo với vai trò du khách.' : 'Cập nhật thông tin và quyền của tài khoản.'} className="max-w-2xl">
      <form className="grid gap-4" onSubmit={submitForm}>
        <div className="grid gap-4 sm:grid-cols-2"><FormField label="Username"><input required minLength={3} maxLength={50} pattern="[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?" value={form.username} onChange={event => changeForm('username', event.target.value)} /></FormField><FormField label="Email"><input type="email" required maxLength={254} value={form.email} onChange={event => changeForm('email', event.target.value)} /></FormField>
          {dialog === 'create' && <FormField label="Mật khẩu"><input type="password" required minLength={8} maxLength={72} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,72}" value={form.password} onChange={event => changeForm('password', event.target.value)} /></FormField>}
          <FormField label="Tên hiển thị"><input maxLength={150} value={form.displayName} onChange={event => changeForm('displayName', event.target.value)} /></FormField><FormField label="Họ"><input maxLength={100} value={form.firstName} onChange={event => changeForm('firstName', event.target.value)} /></FormField><FormField label="Tên"><input maxLength={100} value={form.lastName} onChange={event => changeForm('lastName', event.target.value)} /></FormField><FormField label="Số điện thoại"><input inputMode="tel" pattern="\+?[0-9]{8,15}" value={form.phoneNumber} onChange={event => changeForm('phoneNumber', event.target.value)} /></FormField><FormField label="Ngày sinh"><input type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={event => changeForm('dateOfBirth', event.target.value)} /></FormField><FormField label="Giới tính"><select value={form.gender} onChange={event => changeForm('gender', event.target.value as AdminUserGender | '')}><option value="">Chưa cập nhật</option>{Object.entries(genderLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
          {dialog === 'edit' && <><FormField label="Vai trò"><select value={form.role} onChange={event => changeForm('role', event.target.value as AdminUserRole)}>{Object.entries(roleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField><FormField label="Trạng thái"><select value={form.status} onChange={event => changeForm('status', event.target.value as AdminUserStatus)}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField></>}
        </div><Feedback message={formError} kind="error" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => closeDialog(false)}>Hủy</Button><Button disabled={busy}>{busy ? 'Đang lưu...' : dialog === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi'}</Button></div>
      </form>
    </DialogContent></Dialog>

    <Dialog open={dialog === 'detail'} onOpenChange={closeDialog}><DialogContent title="Thông tin tài khoản" description={detail.data?.email}>
      {detail.isPending ? <LoadingState /> : detail.isError ? <ErrorState message={errorMessage(detail.error)} retry={() => { void detail.refetch() }} /> : detail.data && <><dl className="grid gap-4 text-sm sm:grid-cols-2"><Info label="Username" value={detail.data.username} /><Info label="Tên" value={detail.data.displayName || [detail.data.firstName, detail.data.lastName].filter(Boolean).join(' ') || 'Chưa cập nhật'} /><Info label="Email" value={detail.data.email} /><Info label="Số điện thoại" value={detail.data.phoneNumber || 'Chưa cập nhật'} /><Info label="Vai trò" value={roleLabel[detail.data.role]} /><Info label="Trạng thái" value={statusLabel[detail.data.status]} /><Info label="Giới tính" value={detail.data.gender ? genderLabel[detail.data.gender] : 'Chưa cập nhật'} /><Info label="Ngày sinh" value={detail.data.dateOfBirth ? day(detail.data.dateOfBirth) : 'Chưa cập nhật'} /><Info label="Email" value={detail.data.isEmailVerified ? 'Đã xác minh' : 'Chưa xác minh'} /><Info label="Đăng nhập Google" value={detail.data.googleAccountLinked ? 'Đã liên kết' : 'Chưa liên kết'} /><Info label="Ngày tạo" value={day(detail.data.createdAt.slice(0, 10))} /><Info label="Cập nhật gần nhất" value={day(detail.data.updatedAt.slice(0, 10))} /></dl><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => { if (detail.data) openUser(detail.data, 'edit') }}>Chỉnh sửa</Button><Button onClick={() => closeDialog(false)}>Đóng</Button></div></>}</DialogContent></Dialog>

    <Dialog open={dialog === 'password'} onOpenChange={closeDialog}><DialogContent title="Đặt lại mật khẩu" description={`Tài khoản: ${detail.data?.username ?? ''}`}><form className="grid gap-4" onSubmit={submitPassword}><FormField label="Mật khẩu mới"><input type="password" required minLength={8} maxLength={72} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,72}" value={newPassword} onChange={event => setNewPassword(event.target.value)} /></FormField><FormField label="Nhập lại mật khẩu"><input type="password" required minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></FormField><Feedback message={formError} kind="error" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => closeDialog(false)}>Hủy</Button><Button disabled={busy}>{busy ? 'Đang cập nhật...' : 'Xác nhận đặt lại'}</Button></div></form></DialogContent></Dialog>

    <Dialog open={dialog === 'delete'} onOpenChange={closeDialog}><DialogContent title="Xóa tài khoản này?" description={`Tài khoản ${detail.data?.username ?? selectedUser?.username ?? ''} sẽ không còn xuất hiện trong danh sách.`}><Feedback message={formError} kind="error" /><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => closeDialog(false)}>Hủy</Button><Button variant="danger" disabled={busy} onClick={() => { void deleteUser() }}>{busy ? 'Đang xóa...' : 'Xóa tài khoản'}</Button></div></DialogContent></Dialog>
  </div>
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div> }
