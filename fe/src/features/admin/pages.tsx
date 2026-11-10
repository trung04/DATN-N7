import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { repo, isMock } from '@/services'
import { currency, day, errorMessage } from '@/lib/utils'
import { useAdminData } from '@/hooks/data'
import type { VerificationStatus } from '@/types/domain'

function AdminStat({ label, value }: { label: string; value: string }) { return <Card className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold text-[#1E3A5F]">{value}</p></Card> }

export function AdminPartnersPage() {
  const { data, isLoading, error } = useAdminData()
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').toLowerCase()
  const status = params.get('status') ?? ''
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  const items = data?.partners.filter(p => (!q || (p.name + ' ' + p.email).toLowerCase().includes(q)) && (!status || p.status === status)) ?? []
  return <div><PageHeader title="Quản lý đối tác" description="Xác minh hồ sơ và theo dõi trạng thái xử lý." /><div className="mb-5 grid gap-3 sm:grid-cols-2"><FormField label="Tên hoặc email"><input value={params.get('q') ?? ''} onChange={e => { const next = new URLSearchParams(params); if (e.target.value) next.set('q', e.target.value); else next.delete('q'); setParams(next) }} /></FormField><FormField label="Trạng thái"><select value={status} onChange={e => { const next = new URLSearchParams(params); if (e.target.value) next.set('status', e.target.value); else next.delete('status'); setParams(next) }}><option value="">Tất cả</option><option value="PENDING">Chờ xác minh</option><option value="VERIFIED">Đã xác minh</option><option value="REJECTED">Bị từ chối</option><option value="NEEDS_INFO">Cần bổ sung</option></select></FormField></div>{items.length ? <Card className="table-scroll"><table><thead><tr><th>Mã</th><th>Doanh nghiệp</th><th>Loại</th><th>Email</th><th>Ngày đăng ký</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{items.map(p => <tr key={p.id}><td>{p.id}</td><td className="font-semibold">{p.name}</td><td>{p.type}</td><td>{p.email}</td><td>{day(p.registeredAt.slice(0, 10))}</td><td><StatusBadge status={p.status} /></td><td><Link className="font-semibold text-[#1E3A5F] hover:underline" to={'/admin/partners/' + p.id}>Chi tiết</Link></td></tr>)}</tbody></table></Card> : <EmptyState title="Không có đối tác phù hợp" />}</div>
}
export function AdminPartnerDetailPage() {
  const { id } = useParams()
  const { data, isLoading, error } = useAdminData()
  const queryClient = useQueryClient()
  const [next, setNext] = useState<VerificationStatus>('VERIFIED')
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  const partner = data?.partners.find(p => p.id === id)
  if (!partner) return <EmptyState title="Không tìm thấy đối tác" />
  return <div><Link className="text-sm text-[#1E3A5F]" to="/admin/partners">← Danh sách đối tác</Link><div className="mt-5"><PageHeader title={partner.name} description={partner.email} actions={<StatusBadge status={partner.status} />} /></div><Card className="p-6"><dl className="grid gap-5 text-sm sm:grid-cols-2"><Info label="Mã đối tác" value={partner.id} /><Info label="Loại đối tác" value={partner.type} /><Info label="Ngày đăng ký" value={day(partner.registeredAt.slice(0, 10))} /><Info label="Khách sạn" value={data?.hotels.filter(h => partner.hotelIds.includes(h.id)).map(h => h.name).join(', ') ?? ''} /><Info label="Ngân hàng nhận" value={partner.bankName + ' · ••••' + partner.bankLast4} /><Info label="Ghi chú xử lý" value={partner.note || 'Chưa có'} /></dl><div className="mt-6 flex flex-wrap gap-2">{partner.status !== 'VERIFIED' && <Button onClick={() => { setNext('VERIFIED'); setOpen(true) }}>Phê duyệt</Button>}<Button variant="secondary" onClick={() => { setNext('NEEDS_INFO'); setOpen(true) }}>Yêu cầu bổ sung</Button><Button variant="danger" onClick={() => { setNext('REJECTED'); setOpen(true) }}>Từ chối</Button></div><div className="mt-4"><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /></div></Card><Dialog open={open} onOpenChange={setOpen}><DialogContent title="Xác nhận xử lý hồ sơ" description={'Trạng thái mới: ' + next}><FormField label={next === 'VERIFIED' ? 'Ghi chú (không bắt buộc)' : 'Lý do / yêu cầu bổ sung'}><textarea value={note} onChange={e => setNote(e.target.value)} /></FormField><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Hủy</Button><Button onClick={async () => { try { await repo.verifyPartner(partner.id, next as 'VERIFIED' | 'REJECTED' | 'NEEDS_INFO', note, partner.revision); await queryClient.invalidateQueries({ queryKey: ['admin'] }); setOpen(false); setMessage('Đã cập nhật hồ sơ đối tác.') } catch (err) { setMessage(errorMessage(err)) } }}>Xác nhận</Button></div></DialogContent></Dialog></div>
}
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div> }

export function AdminServicesPage() {
  const { data, isLoading, error } = useAdminData()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  return <div><PageHeader title="Dịch vụ du lịch" description="Theo dõi dịch vụ trong danh mục và bật/tắt trạng thái sử dụng." /><Card className="table-scroll"><table><thead><tr><th>Mã</th><th>Dịch vụ</th><th>Danh mục</th><th>Đối tác</th><th>Địa điểm</th><th>Giá tham khảo</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data?.services.map(s => <tr key={s.id}><td>{s.id}</td><td className="font-semibold">{s.name}</td><td>{data.categories.find(c => c.id === s.categoryId)?.name}</td><td>{data.partners.find(p => p.id === s.partnerId)?.name}</td><td>{s.city}</td><td>{currency(s.price)}</td><td>{s.active ? 'Đang dùng' : 'Tạm ẩn'}</td><td><Button size="sm" variant="secondary" onClick={async () => { try { await repo.toggleService(s.id); await queryClient.invalidateQueries({ queryKey: ['admin'] }); setMessage('Đã cập nhật trạng thái dịch vụ.') } catch (err) { setMessage(errorMessage(err)) } }}>{s.active ? 'Tạm ẩn' : 'Bật lại'}</Button></td></tr>)}</tbody></table></Card><div className="mt-4"><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /></div></div>
}
export function AdminCategoriesPage() {
  const { data, isLoading, error } = useAdminData()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  const edit = (id?: string) => { const item = data?.categories.find(c => c.id === id); setEditing(id); setName(item?.name ?? ''); setDescription(item?.description ?? ''); setActive(item?.active ?? true); setOpen(true) }
  return <div><PageHeader title="Danh mục dịch vụ" description="Quản lý tên, mô tả và trạng thái sử dụng." actions={<Button onClick={() => edit()}>Thêm danh mục</Button>} /><div className="grid gap-3">{data?.categories.map(c => <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-semibold">{c.name}</h2><p className="text-sm text-slate-500">{c.description}</p><span className="text-xs text-slate-500">{c.active ? 'Đang dùng' : 'Tạm ngưng'}</span></div><Button size="sm" variant="secondary" onClick={() => edit(c.id)}>Chỉnh sửa</Button></Card>)}</div><div className="mt-4"><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /></div><Dialog open={open} onOpenChange={setOpen}><DialogContent title={editing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'}><form className="grid gap-4" onSubmit={async e => { e.preventDefault(); try { await repo.saveCategory(editing, name, description, active); await queryClient.invalidateQueries({ queryKey: ['admin'] }); setOpen(false); setMessage('Đã lưu danh mục.') } catch (err) { setMessage(errorMessage(err)) } }}><FormField label="Tên danh mục"><input required value={name} onChange={e => setName(e.target.value)} /></FormField><FormField label="Mô tả"><textarea value={description} onChange={e => setDescription(e.target.value)} /></FormField><label className="flex items-center gap-2 text-sm"><input className="!m-0 !h-4 !w-4 !min-h-0" type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Đang sử dụng</label><Button>Lưu danh mục</Button></form></DialogContent></Dialog></div>
}
export function AdminReviewsPage() {
  const { data, isLoading, error } = useAdminData()
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  return <div><PageHeader title="Quản lý đánh giá" description="Xem và xử lý đánh giá khách sạn." />{data?.reviews.length ? <Card className="table-scroll"><table><thead><tr><th>Mã</th><th>Khách sạn</th><th>Người đánh giá</th><th>Số sao</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.reviews.map(r => <tr key={r.id}><td>{r.id}</td><td>{data.hotels.find(h => h.id === r.hotelId)?.name}</td><td>{data.users.find(u => u.id === r.userId)?.name}</td><td>{r.stars}/5</td><td><StatusBadge status={r.status} /></td><td><Link className="font-semibold text-[#1E3A5F]" to={'/admin/reviews/' + r.id}>Chi tiết</Link></td></tr>)}</tbody></table></Card> : <EmptyState title="Chưa có đánh giá" description="Đánh giá mới sẽ xuất hiện khi du khách hoàn thành lưu trú và gửi nhận xét." />}</div>
}
export function AdminReviewDetailPage() {
  const { id } = useParams()
  const { data, isLoading, error } = useAdminData()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  const review = data?.reviews.find(r => r.id === id)
  if (!review) return <EmptyState title="Không tìm thấy đánh giá" />
  return <div><Link className="text-sm text-[#1E3A5F]" to="/admin/reviews">← Danh sách đánh giá</Link><div className="mt-5"><PageHeader title={'Đánh giá ' + review.id} actions={<StatusBadge status={review.status} />} /></div><Card className="p-6"><p className="text-sm text-slate-500">{data?.hotels.find(h => h.id === review.hotelId)?.name} · {review.stars}/5 sao · {data?.users.find(u => u.id === review.userId)?.name}</p><p className="mt-4 leading-7">{review.content}</p>{review.moderationReason && <p className="mt-3 text-sm text-slate-500">Lý do xử lý: {review.moderationReason}</p>}<Button className="mt-6" variant={review.status === 'HIDDEN' ? 'secondary' : 'danger'} onClick={() => setOpen(true)}>{review.status === 'HIDDEN' ? 'Hiển thị lại' : 'Ẩn đánh giá'}</Button><div className="mt-4"><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /></div></Card><Dialog open={open} onOpenChange={setOpen}><DialogContent title={review.status === 'HIDDEN' ? 'Hiển thị lại đánh giá?' : 'Ẩn đánh giá?'}>{review.status !== 'HIDDEN' && <FormField label="Lý do ẩn"><textarea value={reason} onChange={e => setReason(e.target.value)} /></FormField>}<div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Hủy</Button><Button onClick={async () => { try { await repo.moderateReview(review.id, review.status === 'HIDDEN' ? 'VISIBLE' : 'HIDDEN', reason); await queryClient.invalidateQueries(); setOpen(false); setMessage('Đã cập nhật đánh giá.') } catch (err) { setMessage(errorMessage(err)) } }}>Xác nhận</Button></div></DialogContent></Dialog></div>
}

export function AdminReportsPage() {
  const { data, isLoading, error } = useAdminData()
  const [tab, setTab] = useState<'users' | 'partners' | 'bookings' | 'revenue'>('bookings')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  const bookings = data?.bookings.filter(b => (!from || b.createdAt.slice(0, 10) >= from) && (!to || b.createdAt.slice(0, 10) <= to)) ?? []
  const paid = data?.payments.filter(p => p.status === 'PAID' && (!from || p.createdAt.slice(0, 10) >= from) && (!to || p.createdAt.slice(0, 10) <= to)) ?? []
  const chartData = [
    { name: 'Chờ', value: bookings.filter(b => b.status === 'PENDING_PAYMENT').length },
    { name: 'Xác nhận', value: bookings.filter(b => b.status === 'CONFIRMED').length },
    { name: 'Hoàn tất', value: bookings.filter(b => b.status === 'COMPLETED').length },
    { name: 'Đã hủy', value: bookings.filter(b => b.status === 'CANCELLED').length },
  ]
  return <div><PageHeader title="Báo cáo và thống kê" description="Tổng hợp từ bản ghi hiện có; không sử dụng chỉ số ngẫu nhiên." /><div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-xl"><FormField label="Từ ngày"><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></FormField><FormField label="Đến ngày"><input type="date" min={from} value={to} onChange={e => setTo(e.target.value)} /></FormField></div><div role="tablist" aria-label="Loại báo cáo" className="mb-5 flex flex-wrap gap-2">{[{ id: 'users', label: 'Người dùng' }, { id: 'partners', label: 'Đối tác' }, { id: 'bookings', label: 'Booking' }, { id: 'revenue', label: 'Doanh thu' }].map(x => <Button key={x.id} role="tab" aria-selected={tab === x.id} variant={tab === x.id ? 'default' : 'secondary'} size="sm" onClick={() => setTab(x.id as typeof tab)}>{x.label}</Button>)}</div>{tab === 'users' ? <div className="grid gap-4 sm:grid-cols-3"><AdminStat label="Tổng tài khoản" value={String(data?.users.length ?? 0)} /><AdminStat label="Du khách" value={String(data?.users.filter(u => u.role === 'tourist').length ?? 0)} /><AdminStat label="Tài khoản quản lý" value={String(data?.users.filter(u => u.role !== 'tourist').length ?? 0)} /></div> : tab === 'partners' ? <div className="grid gap-4 sm:grid-cols-3"><AdminStat label="Đối tác" value={String(data?.partners.length ?? 0)} /><AdminStat label="Đã xác minh" value={String(data?.partners.filter(p => p.status === 'VERIFIED').length ?? 0)} /><AdminStat label="Chờ xác minh" value={String(data?.partners.filter(p => p.status === 'PENDING').length ?? 0)} /></div> : tab === 'bookings' ? <><div className="grid gap-4 sm:grid-cols-3"><AdminStat label="Booking trong kỳ" value={String(bookings.length)} /><AdminStat label="Đã xác nhận" value={String(bookings.filter(b => b.status === 'CONFIRMED').length)} /><AdminStat label="Hoàn tất" value={String(bookings.filter(b => b.status === 'COMPLETED').length)} /></div><Card className="mt-5 p-5"><h2 className="mb-5 font-semibold">Booking theo trạng thái (số booking)</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#1E3A5F" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card></> : <><div className="grid gap-4 sm:grid-cols-3"><AdminStat label="Giao dịch đã thanh toán" value={String(paid.length)} /><AdminStat label="Tổng tiền đã ghi nhận" value={currency(paid.reduce((n, p) => n + p.amount, 0))} /><AdminStat label="Hoàn tiền đã xử lý" value={currency(data?.refunds.filter(r => r.status === 'REFUNDED').reduce((n, r) => n + r.amount, 0) ?? 0)} /></div><p className="mt-4 text-sm text-slate-500">Doanh thu hiển thị là tiền thanh toán đã ghi nhận trong dữ liệu demo, chưa trừ hoa hồng hoặc chi phí.</p></>}</div>
}

export function AdminSettlementsPage() {
  const { data, isLoading, error } = useAdminData()
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  return <div><PageHeader title="Đối soát và chi trả" description="Khoản chi trả demo dựa trên booking đủ điều kiện và hoa hồng đã xác định." />{data?.settlements.length ? <Card className="table-scroll"><table><thead><tr><th>Mã</th><th>Khách sạn</th><th>Kỳ</th><th>Doanh thu</th><th>Hoa hồng</th><th>Cần trả</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.settlements.map(s => <tr key={s.id}><td>{s.id}</td><td>{data.hotels.find(h => h.id === s.hotelId)?.name}</td><td>{day(s.periodStart)} – {day(s.periodEnd)}</td><td>{currency(s.gross)}</td><td>{currency(s.commission)}</td><td className="font-semibold">{currency(s.net)}</td><td><StatusBadge status={s.status} /></td><td><Link className="font-semibold text-[#1E3A5F]" to={'/admin/settlements/' + s.id}>Chi tiết</Link></td></tr>)}</tbody></table></Card> : <EmptyState title="Chưa có kỳ đối soát" />}</div>
}
export function AdminSettlementDetailPage() {
  const { id } = useParams()
  const { data, isLoading, error } = useAdminData()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  const settlement = data?.settlements.find(s => s.id === id)
  if (!settlement) return <EmptyState title="Không tìm thấy khoản đối soát" />
  const partner = data?.partners.find(p => p.id === settlement.partnerId)
  const hotel = data?.hotels.find(h => h.id === settlement.hotelId)
  const next = settlement.status === 'DRAFT' || settlement.status === 'FAILED' ? 'APPROVED' : settlement.status === 'APPROVED' ? 'PROCESSING' : null
  const transition = async (status: 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED') => { try { await repo.transitionSettlement(settlement.id, status, settlement.revision); await queryClient.invalidateQueries({ queryKey: ['admin'] }); setOpen(false); setMessage('Đã cập nhật trạng thái đối soát demo.') } catch (err) { setMessage(errorMessage(err)) } }
  return <div><Link className="text-sm text-[#1E3A5F]" to="/admin/settlements">← Danh sách đối soát</Link><div className="mt-5"><PageHeader title={'Đối soát ' + settlement.id} description={(hotel?.name ?? '') + ' · ' + day(settlement.periodStart) + ' – ' + day(settlement.periodEnd)} actions={<StatusBadge status={settlement.status} />} /></div><div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><Card className="min-w-0 p-6"><h2 className="text-lg font-semibold">Booking thuộc kỳ</h2><div className="table-scroll mt-4"><table><thead><tr><th>Mã booking</th><th>Hoàn tất</th><th>Doanh thu</th><th>Hoa hồng</th><th>Cần trả</th></tr></thead><tbody>{settlement.bookingIds.map(bookingId => { const b = data?.bookings.find(x => x.id === bookingId); if (!b) return null; const commission = Math.round(b.total * (partner?.commissionRate ?? 0)); return <tr key={bookingId}><td>{bookingId}</td><td>{day(b.checkOut)}</td><td>{currency(b.total)}</td><td>{currency(commission)}</td><td>{currency(b.total - commission)}</td></tr> })}</tbody></table></div><div className="mt-5 grid gap-2 border-t border-slate-200 pt-4 text-sm"><p className="flex justify-between"><span>Tổng doanh thu</span><strong>{currency(settlement.gross)}</strong></p><p className="flex justify-between"><span>Hoa hồng</span><strong>{currency(settlement.commission)}</strong></p><p className="flex justify-between"><span>Điều chỉnh</span><strong>{currency(settlement.adjustment)}</strong></p><p className="flex justify-between text-lg"><span>Cần trả</span><strong className="text-[#1E3A5F]">{currency(settlement.net)}</strong></p></div></Card><Card className="h-fit p-5"><h2 className="font-semibold">Thông tin chi trả</h2><p className="mt-3 text-sm">Đối tác: {partner?.name}</p><p className="mt-2 text-sm">Ngân hàng: {partner?.bankName}</p><p className="mt-2 text-sm">Tài khoản: ••••{partner?.bankLast4}</p>{settlement.transferReference && <p className="mt-2 text-sm">Mã giao dịch demo: {settlement.transferReference}</p>}{isMock && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Chi trả này chỉ là mô phỏng. Không chuyển khoản thật.</p>}<div className="mt-5 grid gap-2">{next && <Button onClick={() => setOpen(true)}>{next === 'APPROVED' ? 'Duyệt chi trả' : 'Bắt đầu xử lý demo'}</Button>}{settlement.status === 'PROCESSING' && isMock && <><Button onClick={() => transition('PAID')}>Mô phỏng thành công</Button><Button variant="secondary" onClick={() => transition('FAILED')}>Mô phỏng thất bại</Button></>}</div><div className="mt-4"><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /></div></Card></div><Dialog open={open} onOpenChange={setOpen}><DialogContent title="Xác nhận chi trả" description={'Số tiền cần trả: ' + currency(settlement.net) + ' · tài khoản ••••' + partner?.bankLast4}><p className="text-sm text-slate-600">Kiểm tra kỳ đối soát và thông tin ngân hàng trước khi tiếp tục.</p><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Quay lại</Button><Button onClick={() => next && transition(next)}>Xác nhận</Button></div></DialogContent></Dialog></div>
}
