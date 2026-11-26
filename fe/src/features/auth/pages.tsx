import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, Check, Compass, Hotel, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, Feedback, FormField, PasswordInput } from '@/components/common'
import { Button } from '@/components/ui/button'
import { demoAccounts, DEMO_PASSWORD } from '@/services/mock/seed'
import { isMock, repo } from '@/services'
import { googleLoginUrl } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'
import { useSession } from '@/stores/session'
import type { Role } from '@/types/domain'
import { cn } from '@/lib/cn'
import { localReturnPath, loginDestination } from '@/lib/auth-navigation'
import { clearOtpResendCooldown, formatOtpCountdown, startOtpResendCooldown, useOtpResendCooldown } from './otp-cooldown'

function GoogleIcon({ className = 'h-4 w-4 shrink-0' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

function PasswordRequirements({ password }: { password?: string }) {
  if (!password) return null
  const rules = [
    { label: 'Tối thiểu 8 ký tự', ok: (password?.length ?? 0) >= 8 },
    { label: 'Có chữ cái', ok: /[A-Za-z]/.test(password ?? '') },
    { label: 'Có chữ số', ok: /[0-9]/.test(password ?? '') },
  ]
  return (
    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
      <span className="font-medium text-slate-600">Độ mạnh mật khẩu:</span>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {rules.map(r => (
          <span key={r.label} className={cn('inline-flex items-center gap-1', r.ok ? 'font-medium text-emerald-700' : 'text-slate-400')}>
            {r.ok ? <Check size={12} className="stroke-[2.5]" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
            {r.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const loginSchema = z.object({ username: z.string().min(1, 'Nhập tên đăng nhập hoặc email.'), password: z.string().min(1, 'Nhập mật khẩu.') })
const registerSchema = z.object({ name: z.string().min(2, 'Tên cần ít nhất 2 ký tự.'), username: z.string().min(3, 'Tên đăng nhập cần ít nhất 3 ký tự.').max(50).regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/, 'Chỉ dùng chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.'), email: z.email('Email không hợp lệ.'), password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.').regex(/[A-Za-z]/, 'Mật khẩu cần có chữ cái.').regex(/[0-9]/, 'Mật khẩu cần có chữ số.'), confirm: z.string() }).refine(x => x.password === x.confirm, { path: ['confirm'], message: 'Mật khẩu xác nhận không khớp.' })
const resetSchema = z.object({ otp: z.string().length(6, 'OTP gồm 6 chữ số.'), password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.').regex(/[A-Za-z]/, 'Mật khẩu cần có chữ cái.').regex(/[0-9]/, 'Mật khẩu cần có chữ số.'), confirm: z.string() }).refine(x => x.password === x.confirm, { path: ['confirm'], message: 'Mật khẩu xác nhận không khớp.' })
const loginPathByRole: Record<Role, string> = { tourist: '/dang-nhap', partner: '/chu-khach-san/dang-nhap', admin: '/admin/dang-nhap' }
const roleLabel: Record<Role, string> = { tourist: 'du khách', partner: 'chủ khách sạn', admin: 'quản trị viên' }
const loginPortals: Array<{ role: Role; path: string; label: string }> = [
  { role: 'tourist', path: loginPathByRole.tourist, label: 'Du khách' },
  { role: 'partner', path: loginPathByRole.partner, label: 'Chủ khách sạn' },
  { role: 'admin', path: loginPathByRole.admin, label: 'Quản trị viên' },
]
const loginPortalContent: Record<Role, { title: string; description: string; icon: typeof Compass; label: string }> = {
  tourist: { title: 'Đăng nhập du khách', description: 'Lưu địa điểm yêu thích, quản lý lịch trình và booking của bạn.', icon: Compass, label: 'Không gian du lịch' },
  partner: { title: 'Đăng nhập chủ khách sạn', description: 'Quản lý khách sạn, phòng nghỉ và hoạt động kinh doanh.', icon: Hotel, label: 'Cổng đối tác khách sạn' },
  admin: { title: 'Đăng nhập quản trị viên', description: 'Truy cập khu vực quản trị và vận hành hệ thống.', icon: ShieldCheck, label: 'Cổng quản trị hệ thống' },
}
const apiErrorCode = (error: unknown): unknown => {
  const value = error as { code?: unknown; response?: { data?: { code?: unknown } } } | null
  return value?.code ?? value?.response?.data?.code
}
const passwordResetErrorMessage = (error: unknown): string => {
  switch (apiErrorCode(error)) {
    case 'AUTH_ACCOUNT_NOT_FOUND': return 'Email này chưa được đăng ký. Vui lòng kiểm tra lại hoặc tạo tài khoản.'
    case 'AUTH_PASSWORD_RESET_UNAVAILABLE': return 'Tài khoản này chưa thể đặt lại mật khẩu. Hãy xác minh email hoặc dùng phương thức đăng nhập đã liên kết.'
    case 'AUTH_EMAIL_DELIVERY_FAILED': return 'Không gửi được mã đặt lại mật khẩu. Vui lòng thử lại sau.'
    case 'AUTH_OTP_RATE_LIMITED': return 'Bạn vừa yêu cầu mã OTP. Vui lòng đợi một phút rồi thử lại.'
    default: return errorMessage(error)
  }
}

function googleErrorMessage(error: string | null): string {
  switch (error) {
    case 'google_cancelled': return 'Bạn đã hủy đăng nhập bằng Google.'
    case 'google_failed': return 'Không thể xác thực với Google. Vui lòng thử lại.'
    case 'account_link_required': return 'Email này đã được đăng ký nhưng chưa liên kết Google. Hãy đăng nhập bằng mật khẩu, rồi liên kết Google trong trang hồ sơ.'
    case 'google_link_email_mismatch': return 'Tài khoản Google phải dùng cùng email với tài khoản hiện tại.'
    case 'google_session_failed': return 'Không thể khôi phục phiên đăng nhập Google. Vui lòng thử lại.'
    default: return ''
  }
}

export function GoogleCompletePage() {
  const [params] = useSearchParams()
  const user = useSession(s => s.user)
  const returnTo = localReturnPath(params.get('returnTo'))
  if (user) return <Navigate to={loginDestination(user.role, returnTo)} replace />

  const retryParams = new URLSearchParams({ error: 'google_session_failed' })
  if (returnTo) retryParams.set('returnTo', returnTo)
  return <Navigate to={'/auth/login?' + retryParams.toString()} replace />
}

export function TwoFactorLoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const login = useSession(s => s.login)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const requestedReturnTo = localReturnPath(params.get('returnTo'))

  return <Card className="auth-form-card p-6 sm:p-8">
    <h1 className="auth-form-title text-2xl font-semibold">Xác thực 2 bước</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">Nhập mã 6 chữ số từ ứng dụng xác thực hoặc một mã khôi phục.</p>
    <form className="mt-6 grid gap-4" onSubmit={async event => {
      event.preventDefault()
      setBusy(true)
      setMessage('')
      try {
        const result = await repo.verifyTwoFactor(code.trim())
        login(result.user)
        navigate(loginDestination(result.user.role, localReturnPath(result.returnTo) || requestedReturnTo), { replace: true })
      } catch (error) { setMessage(errorMessage(error)) }
      finally { setBusy(false) }
    }}>
      <FormField label="Mã xác thực hoặc mã khôi phục"><input value={code} onChange={event => setCode(event.target.value.toUpperCase().slice(0, 9))} autoComplete="one-time-code" required /></FormField>
      <Feedback message={message} kind="error" />
      <Button disabled={busy}>{busy ? 'Đang xác minh...' : 'Xác minh'}</Button>
    </form>
    <p className="mt-5 text-center text-sm"><Link className="font-semibold text-[#10545b] hover:underline" to="/dang-nhap">Quay lại đăng nhập</Link></p>
  </Card>
}

export function LoginPage({ expectedRole }: { expectedRole?: Role }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const login = useSession(s => s.login)
  const [message, setMessage] = useState('')
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '' } })
  const portal = expectedRole ? loginPortalContent[expectedRole] : null
  const PortalIcon = portal?.icon
  const visibleDemoAccounts = expectedRole ? demoAccounts.filter(account => account.email === ({ tourist: 'khach@demo.vn', partner: 'doitac@demo.vn', admin: 'admin@demo.vn' } as const)[expectedRole]) : demoAccounts
  const showGoogleLogin = !expectedRole || expectedRole === 'tourist'
  const returnTo = localReturnPath(params.get('returnTo'))
  return <Card className="auth-form-card p-6 sm:p-8">
    {portal && <div className="auth-role"><span className="auth-role-icon">{PortalIcon && <PortalIcon size={17} />}</span><span>{portal.label}</span></div>}
    <h1 className="auth-form-title text-2xl font-semibold">{portal?.title ?? 'Đăng nhập'}</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">{portal?.description ?? 'Tiếp tục khám phá và quản lý chuyến đi của bạn.'}</p>
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit(async values => {
      setMessage('')
      try {
        const result = await repo.login(values.username, values.password)
        if ('requiresTwoFactor' in result) {
          const query = new URLSearchParams()
          if (returnTo) query.set('returnTo', returnTo)
          navigate('/auth/two-factor' + (query.size ? `?${query.toString()}` : ''), { replace: true })
          return
        }
        if (expectedRole && result.role !== expectedRole) {
          try { await repo.logout() } catch { /* Keep the role rejection visible even if session cleanup fails. */ }
          setMessage(`Tài khoản này thuộc nhóm ${roleLabel[result.role]}. Hãy chọn đúng cổng đăng nhập bên dưới.`)
          return
        }
        login(result)
        navigate(loginDestination(result.role, returnTo), { replace: true })
      } catch (error) { setMessage(errorMessage(error)) }
    })}>
      <FormField label="Tên đăng nhập hoặc email" error={errors.username?.message}><input autoComplete="username" aria-invalid={Boolean(errors.username)} {...register('username')} /></FormField>
      <FormField label="Mật khẩu" error={errors.password?.message}><PasswordInput autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register('password')} /></FormField>
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 cursor-pointer text-slate-600 text-xs sm:text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-[#10545b]" style={{ minHeight: 'auto', width: 'auto', margin: 0 }} />
          <span>Ghi nhớ đăng nhập</span>
        </label>
        <Link className="font-semibold text-[#10545b] hover:underline text-xs sm:text-sm" to="/auth/forgot-password">Quên mật khẩu?</Link>
      </div>
      <Feedback message={message || googleErrorMessage(params.get('error'))} kind="error" />
      <Button disabled={isSubmitting}>{isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</Button>
    </form>
    {showGoogleLogin && <><div className="my-4 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />HOẶC<span className="h-px flex-1 bg-slate-200" /></div><Button variant="secondary" className="w-full flex items-center justify-center gap-2.5 font-medium" disabled={isMock} onClick={() => { window.location.assign(googleLoginUrl(returnTo)) }}><GoogleIcon />Đăng nhập bằng Google</Button>{isMock && <p className="mt-2 text-xs text-slate-500">Google OAuth cần backend được cấu hình.</p>}</>}
    {isMock && <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">Tài khoản demo · mật khẩu {DEMO_PASSWORD}</p><div className="mt-2 grid gap-1">{visibleDemoAccounts.map(account => <button key={account.email} className="text-left text-sm text-[#10545b] hover:underline" onClick={() => { setValue('username', account.email); setValue('password', DEMO_PASSWORD) }} type="button">{account.role}: {account.email}</button>)}</div></div>}
    {(!expectedRole || expectedRole === 'tourist') && <p className="mt-6 text-center text-sm text-slate-600">Chưa có tài khoản? <Link className="font-semibold text-[#10545b] hover:underline" to="/auth/register">Đăng ký du khách</Link></p>}
    <div className="mt-6 border-t border-slate-100 pt-5"><p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">Chọn cổng đăng nhập</p><nav aria-label="Cổng đăng nhập theo vai trò" className="grid grid-cols-1 gap-2 sm:grid-cols-3">{loginPortals.map(item => <Link key={item.role} to={item.path} aria-current={item.role === expectedRole ? 'page' : undefined} className={'flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors ' + (item.role === expectedRole ? 'border-[#10545b] bg-[#dcefeb] font-semibold text-[#10545b]' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50')}>{item.label}{item.role !== expectedRole && <ArrowRight size={14} />}</Link>)}</nav></div>
  </Card>
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema), defaultValues: { name: '', username: '', email: '', password: '', confirm: '' } })
  const passwordValue = watch('password')

  return <Card className="auth-form-card p-6 sm:p-8">
    <h1 className="auth-form-title text-2xl font-semibold">Tạo tài khoản du khách</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">Dùng tài khoản để lưu sở thích, lịch trình và đặt phòng của bạn.</p>
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit(async values => {
      const email = values.email.trim().toLowerCase()
      try {
        await repo.register(values.name, values.username, email, values.password)
        startOtpResendCooldown(email, 'verification')
        navigate('/auth/verify-otp?email=' + encodeURIComponent(email))
      } catch (error) {
        if (apiErrorCode(error) === 'AUTH_EMAIL_DELIVERY_FAILED') {
          clearOtpResendCooldown(email, 'verification')
          navigate('/auth/verify-otp?delivery=failed&email=' + encodeURIComponent(email))
        } else setMessage(errorMessage(error))
      }
    })}>
      <FormField label="Họ tên" error={errors.name?.message}>
        <input autoComplete="name" aria-invalid={Boolean(errors.name)} {...register('name')} />
      </FormField>
      <FormField label="Tên đăng nhập" hint="Chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang" error={errors.username?.message}>
        <input autoComplete="username" aria-invalid={Boolean(errors.username)} {...register('username', { onChange: e => { e.target.value = e.target.value.toLowerCase() } })} />
      </FormField>
      <FormField label="Email" error={errors.email?.message}>
        <input type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register('email')} />
      </FormField>
      <FormField label="Mật khẩu" error={errors.password?.message}>
        <PasswordInput autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register('password')} />
      </FormField>
      <PasswordRequirements password={passwordValue} />
      <FormField label="Xác nhận mật khẩu" error={errors.confirm?.message}>
        <PasswordInput autoComplete="new-password" aria-invalid={Boolean(errors.confirm)} {...register('confirm')} />
      </FormField>
      <Feedback message={message} kind="error" />
      <Button disabled={isSubmitting}>{isSubmitting ? 'Đang tạo...' : 'Tiếp tục xác thực'}</Button>
    </form>
    <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
      <span className="h-px flex-1 bg-slate-200" />
      HOẶC
      <span className="h-px flex-1 bg-slate-200" />
    </div>
    <Button variant="secondary" className="w-full flex items-center justify-center gap-2.5 font-medium" disabled={isMock} onClick={() => { window.location.assign(googleLoginUrl()) }}>
      <GoogleIcon />Đăng ký bằng Google
    </Button>
    {isMock && <p className="mt-2 text-xs text-slate-500">Chế độ demo không gửi email thật.</p>}
    <p className="mt-4 text-center text-xs text-slate-500">Bằng việc đăng ký, bạn đồng ý với <Link to="/" className="text-[#10545b] underline">Điều khoản dịch vụ</Link> và <Link to="/" className="text-[#10545b] underline">Chính sách bảo mật</Link>.</p>
    <p className="mt-5 text-center text-sm text-slate-600">Đã có tài khoản? <Link className="font-semibold text-[#10545b] hover:underline" to="/dang-nhap">Đăng nhập</Link></p>
    <div className="mt-6 border-t border-slate-100 pt-4 text-center">
      <p className="text-xs text-slate-500">Bạn là chủ khách sạn hoặc homestay? <Link className="font-semibold text-[#10545b] hover:underline" to="/chu-khach-san/dang-nhap">Cổng đối tác khách sạn</Link></p>
    </div>
  </Card>
}

export function VerifyOtpPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const email = params.get('email') ?? ''
  const deliveryFailed = params.get('delivery') === 'failed'
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const cooldown = useOtpResendCooldown(email, 'verification', !deliveryFailed)
  return <Card className="auth-form-card p-6 sm:p-8">
    <h1 className="auth-form-title text-2xl font-semibold">Xác thực tài khoản</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">Nhập mã 6 chữ số đã gửi đến <strong className="font-medium text-slate-700">{email || 'email của bạn'}</strong>.</p>
    {deliveryFailed && <Feedback message="Tài khoản đã được tạo nhưng email chưa gửi được. Hãy bấm Gửi lại mã để thử lại." kind="error" />}
    {isMock && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Mã OTP demo: <strong>123456</strong>.</div>}
    <form className="mt-5 grid gap-4" onSubmit={async e => {
      e.preventDefault()
      setBusy(true)
      try {
        await repo.verifyOtp(email, otp)
        clearOtpResendCooldown(email, 'verification')
        navigate('/dang-nhap?registered=1')
      } catch (error) { setMessage(errorMessage(error)) }
      finally { setBusy(false) }
    }}>
      <FormField label="Mã xác thực OTP">
        <input
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          className="text-center font-mono text-2xl tracking-[0.5em] font-semibold text-slate-800 placeholder:text-slate-300 placeholder:tracking-[0.5em]"
        />
      </FormField>
      <Feedback message={message} kind="error" />
      <Button disabled={busy || otp.length !== 6 || !email}>Xác nhận</Button>
    </form>
    <Button variant="ghost" className="mt-3 w-full" disabled={!email || resending || cooldown > 0} onClick={async () => {
      setResending(true)
      try {
        await repo.resendOtp(email)
        startOtpResendCooldown(email, 'verification')
        setMessage(isMock ? 'Đã tạo lại mã OTP demo.' : 'Nếu tài khoản đang chờ xác minh, mã mới sẽ được gửi qua email.')
        setOtp('')
        if (deliveryFailed) navigate('/auth/verify-otp?email=' + encodeURIComponent(email), { replace: true })
      } catch (error) { setMessage(errorMessage(error)) }
      finally { setResending(false) }
    }}>{resending ? 'Đang gửi mã...' : cooldown > 0 ? `Gửi lại mã sau ${formatOtpCountdown(cooldown)}` : 'Gửi lại mã'}</Button>
    <p className="mt-5 text-center text-xs text-slate-500">Sai địa chỉ email? <Link className="font-semibold text-[#10545b] hover:underline" to="/auth/register">Đăng ký lại với email khác</Link></p>
  </Card>
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return <Card className="auth-form-card p-6 sm:p-8">
    <h1 className="auth-form-title text-2xl font-semibold">Quên mật khẩu</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">Nhập email tài khoản để nhận mã đặt lại mật khẩu.</p>
    <form className="mt-6 grid gap-4" onSubmit={async e => {
      e.preventDefault()
      setBusy(true)
      setMessage('')
      const normalizedEmail = email.trim().toLowerCase()
      try {
        await repo.requestOtp(normalizedEmail)
        startOtpResendCooldown(normalizedEmail, 'password-reset')
        navigate('/auth/reset-password?email=' + encodeURIComponent(normalizedEmail))
      } catch (error) { setMessage(passwordResetErrorMessage(error)) }
      finally { setBusy(false) }
    }}>
      <FormField label="Email">
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
      </FormField>
      <Feedback message={message} kind="error" />
      <Button disabled={busy}>{busy ? 'Đang gửi...' : 'Gửi mã xác nhận'}</Button>
    </form>
    {isMock && <p className="mt-4 text-xs text-slate-500">Chế độ demo dùng mã 123456, không gửi email thật.</p>}
    <p className="mt-6 text-center text-sm text-slate-600">Nhớ lại mật khẩu? <Link className="font-semibold text-[#10545b] hover:underline" to="/dang-nhap">Đăng nhập</Link></p>
  </Card>
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const email = params.get('email') ?? ''
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const cooldown = useOtpResendCooldown(email, 'password-reset')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { otp: '', password: '', confirm: '' } })
  return <Card className="auth-form-card p-6 sm:p-8">
    <h1 className="auth-form-title text-2xl font-semibold">Đặt lại mật khẩu</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">Tài khoản: <strong className="font-medium text-slate-700">{email || 'chưa chọn'}</strong></p>
    {isMock && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Mã demo: <strong>123456</strong></p>}
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit(async values => {
      try {
        await repo.resetPassword(email, values.password, values.otp)
        clearOtpResendCooldown(email, 'password-reset')
        navigate('/dang-nhap?reset=1')
      } catch (error) { setMessage(errorMessage(error)) }
    })}>
      <FormField label="Mã OTP" error={errors.otp?.message}>
        <input inputMode="numeric" autoComplete="one-time-code" aria-invalid={Boolean(errors.otp)} {...register('otp')} />
      </FormField>
      <FormField label="Mật khẩu mới" error={errors.password?.message}>
        <PasswordInput autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register('password')} />
      </FormField>
      <FormField label="Xác nhận mật khẩu" error={errors.confirm?.message}>
        <PasswordInput autoComplete="new-password" aria-invalid={Boolean(errors.confirm)} {...register('confirm')} />
      </FormField>
      <Feedback message={message} kind="error" />
      <Button disabled={isSubmitting || !email}>Lưu mật khẩu mới</Button>
    </form>
    <Feedback message={resendMessage} />
    <Button variant="ghost" className="mt-3 w-full" disabled={!email || resending || cooldown > 0} onClick={async () => {
      setResending(true)
      try {
        await repo.requestOtp(email)
        startOtpResendCooldown(email, 'password-reset')
        setResendMessage(isMock ? 'Đã tạo lại mã OTP demo.' : 'Mã đặt lại mật khẩu đã được gửi.')
        setMessage('')
      } catch (error) {
        setResendMessage('')
        setMessage(passwordResetErrorMessage(error))
      } finally { setResending(false) }
    }}>{resending ? 'Đang gửi mã...' : cooldown > 0 ? `Gửi lại mã sau ${formatOtpCountdown(cooldown)}` : 'Gửi lại mã'}</Button>
    <p className="mt-6 text-center text-sm text-slate-600">Quay lại <Link className="font-semibold text-[#10545b] hover:underline" to="/dang-nhap">Đăng nhập</Link></p>
  </Card>
}
