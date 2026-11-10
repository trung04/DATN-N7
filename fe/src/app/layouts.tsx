import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { ChartNoAxesColumn, Compass, Heart, Hotel, LayoutDashboard, LogOut, Map, Menu, MessageSquareText, ReceiptText, ShieldCheck, Tags, UserRound, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/stores/session'
import { isMock, repo } from '@/services'
import { errorMessage } from '@/lib/utils'

const publicNav = [
  { to: '/', label: 'Trang chủ' }, { to: '/explore', label: 'Khám phá' }, { to: '/hotels', label: 'Khách sạn' },
  { to: '/restaurants', label: 'Nhà hàng' }, { to: '/trips', label: 'Chuyến đi' }, { to: '/ai/recommendations', label: 'Gợi ý AI' },
]
const partnerNav = [{ to: '/partner', label: 'Tổng quan', icon: LayoutDashboard }, { to: '/partner/rooms', label: 'Loại phòng', icon: Hotel }]
const adminNav = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard }, { to: '/admin/partners', label: 'Đối tác', icon: UsersRound },
  { to: '/admin/services', label: 'Dịch vụ', icon: Hotel }, { to: '/admin/service-categories', label: 'Danh mục', icon: Tags },
  { to: '/admin/reviews', label: 'Đánh giá', icon: MessageSquareText }, { to: '/admin/reports', label: 'Báo cáo', icon: ChartNoAxesColumn },
  { to: '/admin/settlements', label: 'Đối soát', icon: ReceiptText },
]

function Brand() { return <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#1E3A5F]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A5F] text-white"><Compass size={21} /></span>Hành Trình Việt</Link> }
export function TouristLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const user = useSession(s => s.user)
  const logout = useSession(s => s.logout)
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')
  return <div className="flex min-h-screen flex-col">
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="container-travel flex h-16 items-center justify-between gap-5">
      <Brand />
      <nav aria-label="Điều hướng chính" className="hidden items-center gap-5 xl:flex">{publicNav.map(n => <NavLink key={n.to} end={n.to === '/'} className={({ isActive }) => 'link-nav' + (isActive ? ' active' : '')} to={n.to}>{n.label}</NavLink>)}</nav>
      <div className="hidden items-center gap-2 sm:flex"><Link className="link-nav inline-flex items-center gap-1" to="/favorites"><Heart size={16} />Yêu thích</Link>{user ? <><Link className="link-nav inline-flex items-center gap-1" to={user.role === 'admin' ? '/admin' : user.role === 'partner' ? '/partner' : '/profile'}><UserRound size={16} />{user.name}</Link><Button size="icon" variant="ghost" aria-label="Đăng xuất" onClick={() => { logout(); navigate('/') }}><LogOut size={17} /></Button></> : <Button asChild size="sm"><Link to="/auth/login">Đăng nhập</Link></Button>}</div>
      <Button className="xl:hidden" variant="ghost" size="icon" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</Button>
    </div>{menuOpen && <nav aria-label="Điều hướng trên điện thoại" className="container-travel grid gap-1 border-t border-slate-100 py-3 xl:hidden">{[...publicNav, { to: '/favorites', label: 'Yêu thích' }, { to: user ? user.role === 'admin' ? '/admin' : user.role === 'partner' ? '/partner' : '/profile' : '/auth/login', label: user ? 'Tài khoản' : 'Đăng nhập' }].map(n => <Link className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" key={n.to} onClick={() => setMenuOpen(false)} to={n.to}>{n.label}</Link>)}</nav>}</header>
    {isMock && <div className="border-b border-amber-100 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">Chế độ demo: AI, OTP và thanh toán chỉ là mô phỏng. <button className="font-semibold underline" onClick={async () => { try { await repo.reset(); setNotice('Đã đặt lại dữ liệu demo.'); logout(); navigate('/') } catch (e) { setNotice(errorMessage(e)) } }}>Đặt lại dữ liệu</button>{notice && <span className="ml-2">{notice}</span>}</div>}
    <main id="main" className="flex-1"><Outlet /></main>
    <footer className="border-t border-slate-200 bg-[#F8FAFC]"><div className="container-travel grid gap-8 py-10 md:grid-cols-3"><div><Brand /><p className="mt-3 max-w-xs text-sm text-slate-500">Lên kế hoạch chuyến đi rõ ràng, phù hợp với sở thích của bạn.</p></div><div><h2 className="font-semibold">Khám phá</h2><div className="mt-3 grid gap-2 text-sm text-slate-600"><Link to="/explore">Điểm đến</Link><Link to="/hotels">Khách sạn</Link><Link to="/restaurants">Nhà hàng</Link></div></div><div><h2 className="font-semibold">Lên kế hoạch</h2><div className="mt-3 grid gap-2 text-sm text-slate-600"><Link to="/ai/trip-planner">Lập lịch trình demo</Link><Link to="/trips">Chuyến đi của tôi</Link></div></div></div><div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">© Hành Trình Việt · Dự án frontend demo</div></footer>
  </div>
}

export function DashboardLayout({ kind }: { kind: 'partner' | 'admin' }) {
  const user = useSession(s => s.user)
  const logout = useSession(s => s.logout)
  const navigate = useNavigate()
  const links = kind === 'partner' ? partnerNav : adminNav
  const container = kind === 'admin' ? 'container-dashboard' : 'container-app'
  return <div className="min-h-screen bg-[#F8FAFC]">
    <header className="border-b border-slate-200 bg-white"><div className={container + ' flex h-[72px] items-center justify-between gap-4'}><Brand /><div className="flex items-center gap-3 text-sm text-slate-600"><span className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#EAF0F6] font-semibold text-[#1E3A5F] sm:flex">{user?.name?.charAt(0) ?? 'U'}</span><span className="hidden font-medium text-slate-700 sm:inline">{user?.name}</span><span className="hidden h-5 w-px bg-slate-200 sm:block" /><Button variant="ghost" size="sm" onClick={() => { logout(); navigate('/') }}><LogOut size={16} />Đăng xuất</Button></div></div></header>
    <div className={container + ' grid gap-6 py-7 lg:grid-cols-[244px_minmax(0,1fr)] xl:gap-8'}>
      <aside className="flex h-fit flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6 lg:min-h-[calc(100vh-128px)]">
        <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF0F6] text-[#1E3A5F]">{kind === 'partner' ? <Hotel size={18} /> : <ShieldCheck size={18} />}</span><div><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Không gian làm việc</p><p className="font-semibold text-[#1E3A5F]">{kind === 'partner' ? 'Khu vực đối tác' : 'Quản trị hệ thống'}</p></div></div>
        <nav aria-label="Điều hướng quản lý" className="mt-3 grid grid-cols-2 gap-1 lg:grid-cols-1">{links.map(n => { const Icon = n.icon; return <NavLink end key={n.to} to={n.to} className={({ isActive }) => 'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors lg:gap-3 ' + (isActive ? 'bg-[#EAF0F6] font-semibold text-[#1E3A5F]' : 'text-slate-600 hover:bg-slate-50 hover:text-[#1E3A5F]')}><Icon size={17} strokeWidth={1.8} className="shrink-0" />{n.label}</NavLink> })}</nav>
        <Link to="/" className="mt-4 flex items-center gap-3 border-t border-slate-100 px-3 pt-4 text-sm text-slate-500 hover:text-[#1E3A5F] lg:mt-auto"><Map size={17} />Về trang du lịch</Link>
      </aside>
      <main id="main" className="min-w-0 pb-10"><Outlet /></main>
    </div>
  </div>
}

export function AuthLayout() { return <div className="min-h-screen bg-[#F8FAFC]"><header className="border-b border-slate-200 bg-white"><div className="container-app flex h-16 items-center"><Brand /></div></header><main className="container-app flex justify-center py-12"><div className="w-full max-w-md"><Outlet /></div></main></div> }
export function NotFound({ forbidden = false }: { forbidden?: boolean }) { return <div className="container-app flex min-h-[60vh] flex-col items-center justify-center text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-[#1E3A5F]">{forbidden ? <ShieldCheck size={30} /> : <LayoutDashboard size={30} />}</div><h1 className="text-3xl font-semibold">{forbidden ? 'Bạn không có quyền truy cập' : 'Không tìm thấy trang'}</h1><p className="mt-2 text-slate-500">{forbidden ? 'Tài khoản hiện tại không được phép mở khu vực này.' : 'Đường dẫn có thể đã thay đổi hoặc không tồn tại.'}</p><Button asChild className="mt-6"><Link to="/">Về trang chủ</Link></Button></div> }
