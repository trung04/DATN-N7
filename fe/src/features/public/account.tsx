import { DateField } from '@/components/ui/date-input'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { PaginatedList } from '@/components/paginated-list'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { repo } from '@/services'
import { currency, errorMessage } from '@/lib/utils'
import { useSession } from '@/stores/session'
import type { TravelPreference } from '@/types/domain'
import { useCatalog, useFavorites, useMyPreference, useMyProfile } from '@/hooks/data'
import { DestinationCard, HotelCard } from './catalog'

const interests = ['Biển', 'Thiên nhiên', 'Ẩm thực', 'Văn hóa', 'Mua sắm', 'Nghỉ dưỡng', 'Khám phá', 'Gia đình']
const genderLabels: Record<string, string> = { FEMALE: 'Nữ', MALE: 'Nam', OTHER: 'Khác', UNDISCLOSED: 'Không muốn tiết lộ' }
export function ProfilePage() {
  const user = useSession(s => s.user)
  const logout = useSession(s => s.logout)
  const login = useSession(s => s.login)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: profile, isLoading, error } = useMyProfile()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [password, setPassword] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [message, setMessage] = useState('')

  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>

  const beginEdit = () => {
    setName(profile?.name ?? '')
    setPhone(profile?.phone ?? '')
    setDateOfBirth(profile?.dateOfBirth ?? '')
    setGender(profile?.gender ?? '')
    setEditing(true)
  }

  return <div className="container-app section-pad">
    <PageHeader title="Hồ sơ của tôi" description="Xem và cập nhật thông tin cá nhân." />
    <Card className="max-w-2xl p-6">
      <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">Thông tin cá nhân</h2>{!editing && <Button size="sm" variant="secondary" onClick={beginEdit}>Chỉnh sửa</Button>}</div>
      {editing ? <form className="grid gap-4" onSubmit={async event => {
        event.preventDefault()
        try {
          if (name.trim().length < 2) throw new Error('Họ tên cần ít nhất 2 ký tự.')
          const next = await repo.saveProfile(user?.id ?? '', { name: name.trim(), phone: phone.trim() || null, dateOfBirth: dateOfBirth || null, gender: gender ? gender as 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED' : null })
          login(next)
          await queryClient.invalidateQueries({ queryKey: ['my-profile', user?.id] })
          await queryClient.invalidateQueries({ queryKey: ['tourist', user?.id] })
          setEditing(false)
          setMessage('Đã cập nhật hồ sơ.')
        } catch (saveError) { setMessage(errorMessage(saveError)) }
      }}>
        <FormField label="Họ tên"><input value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={150} /></FormField>
        <FormField label="Số điện thoại"><input value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" placeholder="+84901234567" /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField label="Ngày sinh" value={dateOfBirth} onChange={value => setDateOfBirth(value)} />
          <FormField label="Giới tính"><select value={gender} onChange={event => setGender(event.target.value)}><option value="">Chưa chọn</option><option value="FEMALE">Nữ</option><option value="MALE">Nam</option><option value="OTHER">Khác</option><option value="UNDISCLOSED">Không muốn tiết lộ</option></select></FormField>
        </div>
        <Feedback message={message} kind={message.includes('Đã') ? 'success' : 'error'} />
        <div className="flex gap-2"><Button>Lưu thay đổi</Button><Button variant="secondary" type="button" onClick={() => { setEditing(false); setMessage('') }}>Hủy</Button></div>
      </form> : <dl className="grid gap-4 text-sm">
        <div><dt className="text-slate-500">Họ tên</dt><dd className="font-medium">{profile?.name || 'Chưa cập nhật'}</dd></div>
        <div><dt className="text-slate-500">Thư điện tử</dt><dd className="font-medium">{profile?.email}</dd></div>
        <div><dt className="text-slate-500">Số điện thoại</dt><dd className="font-medium">{profile?.phone || 'Chưa cập nhật'}</dd></div>
        <div><dt className="text-slate-500">Ngày sinh</dt><dd className="font-medium">{profile?.dateOfBirth || 'Chưa cập nhật'}</dd></div>
        <div><dt className="text-slate-500">Giới tính</dt><dd className="font-medium">{genderLabels[profile?.gender ?? ''] || 'Chưa cập nhật'}</dd></div>
        {profile?.deletionRequestedAt && <div className="text-amber-800">Đã gửi yêu cầu xóa tài khoản.</div>}
        <Feedback message={message} kind="success" />
      </dl>}
    </Card>
    <div className="mt-6 flex flex-wrap gap-3"><Button asChild variant="secondary"><Link to="/preferences">Sở thích du lịch</Link></Button><Button asChild variant="secondary"><Link to="/bookings">Đơn đặt phòng của tôi</Link></Button><Button asChild variant="secondary"><Link to="/trips">Chuyến đi</Link></Button></div>
    <div className="mt-10 max-w-2xl border-t border-slate-200 pt-6"><h2 className="font-semibold text-slate-900">Yêu cầu xóa tài khoản</h2><p className="mt-2 text-sm text-slate-500">Yêu cầu sẽ được ghi nhận và xác minh trước khi xử lý xóa tài khoản.</p><Button className="mt-4" variant="danger" onClick={() => setDeleteOpen(true)}>Gửi yêu cầu xóa</Button></div>
    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent title="Xác nhận yêu cầu xóa tài khoản" description="Nhập mật khẩu để xác thực yêu cầu."><form className="grid gap-4" onSubmit={async event => { event.preventDefault(); try { await repo.requestDeletion(user?.id ?? '', password); setDeleteOpen(false); logout(); navigate('/') } catch (requestError) { setMessage(errorMessage(requestError)) } }}><FormField label="Mật khẩu"><input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></FormField><Feedback message={message} kind="error" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>Hủy</Button><Button variant="danger">Gửi yêu cầu</Button></div></form></DialogContent></Dialog>
  </div>
}
export function PreferencesPage() {
  const userId = useSession(s => s.user?.id)
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useMyPreference()
  const preference = data?.preference
  const preferenceKey = ['my-preference', userId]
  const editorHeading = useRef<HTMLHeadingElement>(null)
  const [edit, setEdit] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [budget, setBudget] = useState(6000000)
  const [style, setStyle] = useState('Cân bằng')
  const [transport, setTransport] = useState('Máy bay')
  const [destinations, setDestinations] = useState('')
  const [feedback, setFeedback] = useState<{ text: string; kind: 'success' | 'error' } | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (edit) editorHeading.current?.focus()
  }, [edit])

  if (isLoading) return <LoadingState />
  if (error && !data) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>

  const startEdit = () => {
    setSelected(preference?.interests ?? [])
    setBudget(preference?.budget ?? 6000000)
    setStyle(preference?.style ?? 'Cân bằng')
    setTransport(preference?.transport ?? 'Máy bay')
    setDestinations(preference?.destinations?.join(', ') ?? '')
    setFeedback(null)
    setEdit(true)
  }

  const updatePreferences = async (next: TravelPreference | null) => {
    await queryClient.cancelQueries({ queryKey: preferenceKey, exact: true })
    queryClient.setQueryData(preferenceKey, { preference: next })
    void queryClient.invalidateQueries({ queryKey: ['tourist'] })
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId || pending) return
    setPending(true)
    setFeedback(null)
    try {
      const next = await repo.savePreference(userId, {
        interests: selected,
        budget,
        style,
        transport,
        destinations: destinations.split(',').map(value => value.trim()).filter(Boolean),
      })
      await updatePreferences(next)
      setEdit(false)
      setFeedback({ text: 'Đã lưu sở thích.', kind: 'success' })
    } catch (err) {
      setFeedback({ text: errorMessage(err), kind: 'error' })
    } finally {
      setPending(false)
    }
  }

  const clear = async () => {
    if (!userId || pending) return
    setPending(true)
    setFeedback(null)
    try {
      await repo.clearPreference(userId)
      await updatePreferences(null)
      setClearOpen(false)
      setFeedback({ text: 'Đã xóa toàn bộ sở thích.', kind: 'success' })
    } catch (err) {
      setFeedback({ text: errorMessage(err), kind: 'error' })
    } finally {
      setPending(false)
    }
  }

  return <div className="container-app section-pad">
    <PageHeader
      title="Sở thích du lịch"
      description="Sở thích được dùng để cá nhân hóa gợi ý khi bạn cho phép."
      actions={!edit && preference && <Button type="button" onClick={startEdit}>Chỉnh sửa</Button>}
    />
    <Card className="max-w-3xl p-6">
      {edit ? <form className="grid gap-5" aria-labelledby="travel-preferences-editor" onSubmit={save}>
        <h2 id="travel-preferences-editor" ref={editorHeading} tabIndex={-1} className="scroll-mt-24 text-lg font-semibold">
          {preference ? 'Chỉnh sửa sở thích' : 'Thêm sở thích'}
        </h2>
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Loại hình yêu thích</legend>
          <div className="flex flex-wrap gap-2">
            {interests.map(interest => <label key={interest} className={'cursor-pointer rounded-full border px-3 py-2 text-sm ' + (selected.includes(interest) ? 'border-[#1E3A5F] bg-[#EAF0F6] text-[#1E3A5F]' : 'border-slate-200')}>
              <input className="sr-only" type="checkbox" checked={selected.includes(interest)} onChange={() => setSelected(current => current.includes(interest) ? current.filter(item => item !== interest) : [...current, interest])} />
              {interest}
            </label>)}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Ngân sách tham khảo (VND)">
            <input type="number" min={0} max={1_000_000_000} step={1} value={budget} onChange={event => setBudget(Number(event.target.value))} />
          </FormField>
          <FormField label="Phong cách">
            <select value={style} onChange={event => setStyle(event.target.value)}>
              <option>Tiết kiệm</option><option>Cân bằng</option><option>Thoải mái</option><option>Nghỉ dưỡng</option>
            </select>
          </FormField>
          <FormField label="Phương tiện">
            <select value={transport} onChange={event => setTransport(event.target.value)}>
              <option>Máy bay</option><option>Ô tô</option><option>Tàu hỏa</option><option>Xe máy</option>
            </select>
          </FormField>
          <FormField label="Điểm đến yêu thích" hint="Ngăn cách bằng dấu phẩy">
            <input value={destinations} onChange={event => setDestinations(event.target.value)} />
          </FormField>
        </div>
        <Feedback message={feedback?.text} kind={feedback?.kind} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu sở thích'}</Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => { setEdit(false); setFeedback(null) }}>Hủy</Button>
        </div>
      </form> : preference ? <div className="grid gap-5">
        <div>
          <h2 className="text-sm font-semibold">Loại hình yêu thích</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {preference.interests.map(interest => <span key={interest} className="rounded-full bg-[#EAF0F6] px-3 py-1 text-sm text-[#1E3A5F]">{interest}</span>)}
          </div>
        </div>
        <p className="text-sm"><strong>Ngân sách:</strong> {currency(preference.budget)}</p>
        <p className="text-sm"><strong>Phong cách:</strong> {preference.style}</p>
        <p className="text-sm"><strong>Phương tiện:</strong> {preference.transport}</p>
        <p className="text-sm"><strong>Điểm đến:</strong> {preference.destinations.join(', ') || 'Chưa chọn'}</p>
        {!clearOpen && <Feedback message={feedback?.text} kind={feedback?.kind} />}
        <Button type="button" variant="danger" className="w-fit" onClick={() => { setFeedback(null); setClearOpen(true) }}>Xóa toàn bộ sở thích</Button>
      </div> : <>
        <EmptyState title="Chưa có sở thích" description="Thêm vài lựa chọn để nhận gợi ý phù hợp hơn." action={<Button type="button" onClick={startEdit}>Thêm sở thích</Button>} />
        {!clearOpen && <Feedback message={feedback?.text} kind={feedback?.kind} />}
      </>}
    </Card>
    <Dialog open={clearOpen} onOpenChange={open => { if (!pending) setClearOpen(open) }}>
      <DialogContent title="Xóa toàn bộ sở thích?" description="Chất lượng gợi ý có thể giảm.">
        <Feedback message={feedback?.text} kind={feedback?.kind} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setClearOpen(false)}>Quay lại</Button>
          <Button type="button" variant="danger" disabled={pending} onClick={clear}>{pending ? 'Đang xóa…' : 'Xóa toàn bộ sở thích'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
}
export function FavoritesPage() {
  const { data: favorites, isLoading, error } = useFavorites()
  const { data: catalog, isLoading: catalogLoading, error: catalogError } = useCatalog()
  if (isLoading || catalogLoading) return <LoadingState />
  const loadError = error ?? catalogError
  if (loadError) return <div className="container-app section-pad"><ErrorState message={errorMessage(loadError)} /></div>
  const destinations = catalog?.destinations.filter(item => favorites?.some(favorite => favorite.targetType === 'PLACE' && favorite.targetId === item.id)) ?? []
  const hotels = catalog?.hotels.filter(item => favorites?.some(favorite => favorite.targetType === 'HOTEL' && favorite.targetId === item.id)) ?? []
  const items = [
    ...destinations.map(item => ({ type: 'PLACE' as const, item })),
    ...hotels.map(item => ({ type: 'HOTEL' as const, item })),
  ]
  return <div className="container-app section-pad">
    <PageHeader title="Yêu thích" description="Những nơi bạn muốn quay lại khi lập kế hoạch." />
    {items.length ? <PaginatedList items={items} label="Phân trang yêu thích">
      {visible => <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.map(({ type, item }) => {
        if (type === 'PLACE') return <DestinationCard key={type + item.id} item={item} />
        const prices = catalog?.rooms.filter(room => room.hotelId === item.id).map(room => room.basePrice) ?? []
        return <HotelCard key={type + item.id} item={item} price={prices.length ? Math.min(...prices) : 0} />
      })}</div>}
    </PaginatedList> : <EmptyState title="Chưa có mục yêu thích" description="Khám phá địa điểm hoặc khách sạn rồi nhấn Lưu yêu thích." action={<Button asChild><Link to="/explore">Khám phá ngay</Link></Button>} />}
  </div>
}

export function RecommendationsPage() {
  const user = useSession(s => s.user)
  const [query, setQuery] = useState('')
  const [extra, setExtra] = useState('')
  const [usePreference, setUsePreference] = useState(true)
  const [results, setResults] = useState<Awaited<ReturnType<typeof repo.recommend>> | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const quick = ['Du lịch tiết kiệm', 'Khám phá điểm đến', 'Du lịch gia đình', 'Nghỉ dưỡng', 'Khám phá thiên nhiên']
  const run = async () => { if (!query.trim()) { setMessage('Vui lòng mô tả chuyến đi mong muốn.'); return } setLoading(true); setResults(null); setMessage(''); try { const items = await repo.recommend(query + ' ' + extra, usePreference ? user?.id : undefined); setResults(items.filter(item => item.type !== 'restaurant')) } catch (error) { setMessage(errorMessage(error)); setResults(null) } finally { setLoading(false) } }
  return <div className="container-app section-pad"><PageHeader title="Gợi ý du lịch" description="Mô tả nhu cầu; công cụ tìm trong danh mục hiện có và giải thích lý do đề xuất." /><Card className="max-w-4xl p-6"><FormField label="Bạn muốn trải nghiệm điều gì?"><textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="Ví dụ: Tôi muốn đi Đà Nẵng 3 ngày 2 đêm, thích biển, ẩm thực và những nơi yên tĩnh." /></FormField><div className="mt-3 flex flex-wrap gap-2">{quick.map(x => <Button key={x} size="sm" variant="secondary" onClick={() => setQuery(query ? query + ', ' + x.toLowerCase() : x)}>{x}</Button>)}</div><div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]"><FormField label="Tiêu chí bổ sung" hint="Có thể bổ sung sau khi xem kết quả mà không cần nhập lại."><input value={extra} onChange={e => setExtra(e.target.value)} placeholder="Ví dụ: khách sạn gần biển" /></FormField><Button className="self-end" disabled={loading} onClick={run}>{loading ? 'Đang tìm...' : 'Nhận gợi ý'}</Button></div>{user?.role === 'tourist' && <label className="mt-4 flex items-center gap-2 text-sm text-slate-600"><input className="!m-0 !h-4 !w-4 !min-h-0" type="checkbox" checked={usePreference} onChange={e => setUsePreference(e.target.checked)} />Sử dụng sở thích đã lưu</label>}<div className="mt-4"><Feedback message={message} kind="error" /></div></Card>{loading && <LoadingState label="Đang tìm kết quả phù hợp trong danh mục..." />}{results && <div className="mt-9"><p className="mb-4 text-sm text-amber-800">Gợi ý theo quy tắc lọc/chấm điểm; không phải AI thật.</p>{results.length ? <PaginatedList items={results} label="Phân trang gợi ý du lịch">{visible => <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(x => <Card className="p-5" key={x.type + x.id}><span className="text-xs font-semibold uppercase text-[#1E3A5F]">{x.type === 'hotel' ? 'Khách sạn' : 'Địa điểm'}</span><h2 className="mt-2 text-lg font-semibold">{x.name}</h2><p className="mt-1 text-sm text-slate-500">{x.city} · {currency(x.price)}</p><p className="mt-3 text-sm text-slate-600">{x.reason}</p><div className="mt-4"><Link className="text-sm font-semibold text-[#1E3A5F] hover:underline" to={x.type === 'hotel' ? '/hotels/' + x.id : '/explore/' + x.id}>Xem chi tiết →</Link></div></Card>)}</div>}</PaginatedList> : <EmptyState title="Chưa có kết quả phù hợp" description="Thử thay đổi điểm đến hoặc sở thích." />}</div>}</div>
}
