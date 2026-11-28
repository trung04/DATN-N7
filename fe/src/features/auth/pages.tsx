import { loginDestination } from '@/lib/auth-navigation'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, Compass, Hotel, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, Feedback, FormField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { isMock, repo } from '@/services'
import { api } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'
import { useSession } from '@/stores/session'
import type { Role } from '@/types/domain'
import { clearOtpResendCooldown, formatOtpCountdown, startOtpResendCooldown, useOtpResendCooldown } from './otp-cooldown'

const loginSchema = z.object({ username: z.string().min(1, 'Nhập tên đăng nhập hoặc thư điện tử.'), password: z.string().min(1, 'Nhập mật khẩu.') })
const registerSchema = z.object({ name: z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự.').max(150, 'Tên không được vượt quá 150 ký tự.'), username: z.string().min(3, 'Tên đăng nhập cần ít nhất 3 ký tự.').max(50, 'Tên đăng nhập không được vượt quá 50 ký tự.').regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/, 'Chỉ dùng chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.'), email: z.email('Địa chỉ thư điện tử không hợp lệ.').max(254, 'Địa chỉ thư điện tử quá dài.'), password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.').max(72, 'Mật khẩu không được vượt quá 72 ký tự.').regex(/[A-Za-z]/, 'Mật khẩu cần có chữ cái.').regex(/[0-9]/, 'Mật khẩu cần có chữ số.'), confirm: z.string() }).refine(x => x.password === x.confirm, { path: ['confirm'], message: 'Mật khẩu xác nhận không khớp.' })
const resetSchema = z.object({ otp: z.string().length(6, 'Mã xác thực gồm 6 chữ số.'), password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.').regex(/[A-Za-z]/, 'Mật khẩu cần có chữ cái.').regex(/[0-9]/, 'Mật khẩu cần có chữ số.'), confirm: z.string() }).refine(x => x.password === x.confirm, { path: ['confirm'], message: 'Mật khẩu xác nhận không khớp.' })
const loginPathByRole: Record<Role, string> = { tourist: '/dang-nhap', partner: '/chu-khach-san/dang-nhap', admin: '/admin/dang-nhap' }
const partnerRegisterPath = '/chu-khach-san/dang-ky'
const partnerVerificationPath = '/chu-khach-san/xac-minh-email'
const roleLabel: Record<Role, string> = { tourist: 'du khách', partner: 'chủ khách sạn', admin: 'quản trị viên' }
const loginPortals: Array<{ role: Role; path: string; label: string }> = [
  { role: 'tourist', path: loginPathByRole.tourist, label: 'Du khách' },
  { role: 'partner', path: loginPathByRole.partner, label: 'Chủ khách sạn' },
  { role: 'admin', path: loginPathByRole.admin, label: 'Quản trị viên' },
]
const loginPortalContent: Record<Role, { title: string; description: string; icon: typeof Compass; label: string }> = {
  tourist: { title: 'Đăng nhập du khách', description: 'Lưu địa điểm yêu thích, quản lý lịch trình và đơn đặt phòng của bạn.', icon: Compass, label: 'Không gian du lịch' },
  partner: { title: 'Đăng nhập chủ khách sạn', description: 'Quản lý khách sạn, phòng nghỉ và hoạt động kinh doanh.', icon: Hotel, label: 'Cổng đối tác khách sạn' },
  admin: { title: 'Đăng nhập quản trị viên', description: 'Truy cập khu vực quản trị và vận hành hệ thống.', icon: ShieldCheck, label: 'Cổng quản trị hệ thống' },
}
const apiErrorCode = (error: unknown): unknown => {
  const value = error as { code?: unknown; response?: { data?: { code?: unknown } } } | null
  return value?.code ?? value?.response?.data?.code
}
const passwordResetErrorMessage = (error: unknown): string => {
  switch (apiErrorCode(error)) {
    case 'AUTH_ACCOUNT_NOT_FOUND': return 'Địa chỉ thư điện tử này chưa được đăng ký. Vui lòng kiểm tra lại hoặc tạo tài khoản.'
    case 'AUTH_PASSWORD_RESET_UNAVAILABLE': return 'Tài khoản này chưa thể đặt lại mật khẩu. Hãy xác minh thư điện tử hoặc dùng phương thức đăng nhập đã liên kết.'
    case 'AUTH_EMAIL_DELIVERY_FAILED': return 'Không gửi được mã đặt lại mật khẩu. Vui lòng thử lại sau.'
    case 'AUTH_OTP_RATE_LIMITED': return 'Bạn vừa yêu cầu mã xác thực. Vui lòng đợi một phút rồi thử lại.'
    default: return errorMessage(error)
  }
}

export function LoginPage({ expectedRole }: { expectedRole?: Role }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const login = useSession(s => s.login)
  const [message, setMessage] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '' } })
  const portal = expectedRole ? loginPortalContent[expectedRole] : null
  const PortalIcon = portal?.icon
  const showGoogleLogin = !expectedRole || expectedRole === 'tourist'
  return <Card className="auth-form-card p-6 sm:p-8">
    {portal && <div className="auth-role"><span className="auth-role-icon">{PortalIcon && <PortalIcon size={17} />}</span><span>{portal.label}</span></div>}
    <h1 className="auth-form-title text-2xl font-semibold">{portal?.title ?? 'Đăng nhập'}</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">{portal?.description ?? 'Tiếp tục khám phá và quản lý chuyến đi của bạn.'}</p>
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit(async values => {
      setMessage('')
      try {
        const user = await repo.login(values.username, values.password)
        if (expectedRole && user.role !== expectedRole) {
          try { await repo.logout() } catch { /* Keep the role rejection visible even if session cleanup fails. */ }
          setMessage(`Tài khoản này thuộc nhóm ${roleLabel[user.role]}. Hãy chọn đúng cổng đăng nhập bên dưới.`)
          return
        }
        login(user)
        const target = params.get('returnTo')
        navigate(loginDestination(user.role, target), { replace: true })
      } catch (error) { setMessage(errorMessage(error)) }
    })}>
      <FormField label="Tên đăng nhập hoặc thư điện tử" error={errors.username?.message}><input autoComplete="username" {...register('username')} /></FormField>
      <FormField label="Mật khẩu" error={errors.password?.message}><input type="password" autoComplete="current-password" {...register('password')} /></FormField>
      <div className="text-right"><Link className="text-sm font-semibold text-[#1E3A5F] hover:underline" to="/auth/forgot-password">Quên mật khẩu?</Link></div>
      <Feedback message={message} kind="error" />
      <Button disabled={isSubmitting}>{isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</Button>
    </form>
    {showGoogleLogin && <><div className="my-4 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />HOẶC<span className="h-px flex-1 bg-slate-200" /></div><Button variant="secondary" className="w-full" disabled={isMock || !import.meta.env.VITE_API_BASE_URL} onClick={() => { window.location.href = import.meta.env.VITE_API_BASE_URL + '/auth/google/start' }}>Đăng nhập bằng Google</Button>{isMock && <p className="mt-2 text-xs text-slate-500">Cần cấu hình đăng nhập Google trên máy chủ.</p>}</>}
    {(!expectedRole || expectedRole === 'tourist') && <p className="mt-6 text-center text-sm text-slate-600">Chưa có tài khoản? <Link className="font-semibold text-[#1E3A5F] hover:underline" to="/auth/register">Đăng ký du khách</Link></p>}
    {expectedRole === 'partner' && !isMock && <p className="mt-6 text-center text-sm text-slate-600">Chưa có tài khoản? <Link className="font-semibold text-[#1E3A5F] hover:underline" to={partnerRegisterPath}>Đăng ký chủ khách sạn</Link></p>}
    <div className="mt-6 border-t border-slate-100 pt-5"><p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">Chọn cổng đăng nhập</p><nav aria-label="Cổng đăng nhập theo vai trò" className="grid grid-cols-1 gap-2 sm:grid-cols-3">{loginPortals.map(item => <Link key={item.role} to={item.path} aria-current={item.role === expectedRole ? 'page' : undefined} className={'flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors ' + (item.role === expectedRole ? 'border-[#1E3A5F] bg-[#EAF0F6] font-semibold text-[#1E3A5F]' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50')}>{item.label}{item.role !== expectedRole && <ArrowRight size={14} />}</Link>)}</nav></div>
  </Card>
}

export function RegisterPage({ partner = false }: { partner?: boolean }) {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [existingEmail, setExistingEmail] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema), defaultValues: { name: '', username: '', email: '', password: '', confirm: '' } })
  const verificationPath = partner ? partnerVerificationPath : '/auth/verify-otp'
  const verifyLink = (email: string) => verificationPath + '?email=' + encodeURIComponent(email)
  const submit = handleSubmit(async values => {
    setMessage('')
    setExistingEmail('')
    const email = values.email.trim().toLowerCase()
    try {
      const createAccount = partner ? api.registerHotelOwner : repo.register
      await createAccount(values.name, values.username, email, values.password)
      startOtpResendCooldown(email, 'verification')
      navigate(verifyLink(email))
    } catch (error) {
      const code = apiErrorCode(error)
      if (code === 'AUTH_EMAIL_DELIVERY_FAILED') {
        clearOtpResendCooldown(email, 'verification')
        navigate(verifyLink(email) + '&delivery=failed')
      } else if (code === 'USER_EMAIL_CONFLICT') {
        setExistingEmail(email)
        setMessage('Địa chỉ thư điện tử này đã được sử dụng. Nếu bạn đang chờ mã xác thực, hãy tiếp tục xác minh.')
      } else if (code === 'USERNAME_CONFLICT') {
        setMessage('Tên đăng nhập đã được sử dụng. Hãy chọn tên khác.')
      } else {
        setMessage(errorMessage(error))
      }
    }
  })

  return <Card className="auth-form-card p-5 sm:p-7">
    {partner && <div className="auth-role"><span className="auth-role-icon"><Hotel size={17} /></span><span>Cổng đối tác khách sạn</span></div>}
    <h1 className="auth-form-title text-2xl font-semibold">{partner ? 'Đăng ký chủ khách sạn' : 'Tạo tài khoản du khách'}</h1>
    <p className="mt-2 text-sm text-slate-500">{partner ? 'Xác minh thư điện tử để tạo tài khoản quản lý khách sạn và phòng nghỉ.' : 'Dùng tài khoản để lưu sở thích, lịch trình và đặt phòng.'}</p>
    <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={submit}>
      <FormField label="Họ tên" error={errors.name?.message}><input autoComplete="name" {...register('name')} /></FormField>
      <FormField label="Tên đăng nhập" error={errors.username?.message}><input autoComplete="username" {...register('username')} /></FormField>
      <div className="sm:col-span-2"><FormField label="Thư điện tử" error={errors.email?.message}><input type="email" autoComplete="email" {...register('email')} /></FormField></div>
      <FormField label="Mật khẩu" error={errors.password?.message} hint="Ít nhất 8 ký tự, có chữ và số."><input type="password" autoComplete="new-password" {...register('password')} /></FormField>
      <FormField label="Xác nhận mật khẩu" error={errors.confirm?.message}><input type="password" autoComplete="new-password" {...register('confirm')} /></FormField>
      {message && <div className="sm:col-span-2"><Feedback message={message} kind="error" />
        {existingEmail && <Link className="mt-2 inline-block text-sm font-semibold text-[#1E3A5F] hover:underline" to={verifyLink(existingEmail)}>Tiếp tục xác minh thư điện tử</Link>}
      </div>}
      <Button className="sm:col-span-2" disabled={isSubmitting}>{isSubmitting ? 'Đang tạo…' : 'Tiếp tục xác thực'}</Button>
    </form>
    {!partner && <Button variant="secondary" className="mt-3 w-full" disabled={isMock || !import.meta.env.VITE_API_BASE_URL} onClick={() => { window.location.href = import.meta.env.VITE_API_BASE_URL + '/auth/google/start' }}>Đăng ký bằng Google</Button>}
    <p className="mt-4 text-center text-sm">Đã có tài khoản? <Link className="font-semibold text-[#1E3A5F] hover:underline" to={loginPathByRole[partner ? 'partner' : 'tourist']}>Đăng nhập</Link></p>
  </Card>
}

export function VerifyOtpPage({ partner = false }: { partner?: boolean }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const login = useSession(state => state.login)
  const email = params.get('email') ?? ''
  const deliveryFailed = params.get('delivery') === 'failed'
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState('')
  const [resendMessage, setResendMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const cooldown = useOtpResendCooldown(email, 'verification', !deliveryFailed)
  const verificationPath = partner ? partnerVerificationPath : '/auth/verify-otp'
  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || otp.length !== 6 || !email) return
    setBusy(true)
    setMessage('')
    try {
      const verifiedUser = await repo.verifyOtp(email, otp)
      clearOtpResendCooldown(email, 'verification')
      login(verifiedUser)
      navigate(loginDestination(verifiedUser.role, null), { replace: true })
    } catch (error) {
      const code = apiErrorCode(error)
      if (code === 'AUTH_OTP_INVALID') setMessage('Mã xác thực sai hoặc đã hết hạn. Hãy nhập lại hoặc yêu cầu mã mới.')
      else if (code === 'AUTH_REGISTRATION_SESSION_UNAVAILABLE') setMessage('Chưa thể mở phiên đăng nhập. Hãy gửi lại mã và thử lại.')
      else setMessage(errorMessage(error))
    } finally { setBusy(false) }
  }

  const resend = async () => {
    setMessage('')
    setResendMessage('')
    setResending(true)
    try {
      await repo.resendOtp(email)
      startOtpResendCooldown(email, 'verification')
      setResendMessage(isMock ? 'Đã tạo lại mã xác thực.' : 'Nếu tài khoản đang chờ xác minh, mã mới sẽ được gửi qua thư điện tử.')
      setOtp('')
      if (deliveryFailed) navigate(verificationPath + '?email=' + encodeURIComponent(email), { replace: true })
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setResending(false) }
  }

  return <Card className="auth-form-card p-5 sm:p-7">
    <h1 className="auth-form-title text-2xl font-semibold">{partner ? 'Xác minh thư điện tử chủ khách sạn' : 'Xác thực tài khoản'}</h1>
    <p className="mt-2 text-sm text-slate-500 wrap-anywhere">Nhập mã 6 chữ số đã gửi đến {email || 'thư điện tử của bạn'}.</p>
    {deliveryFailed && <div className="mt-3"><Feedback message="Tài khoản đã được tạo nhưng email chưa gửi được. Hãy bấm Gửi lại mã để thử lại." kind="error" /></div>}
    <form className="mt-4 grid gap-3" onSubmit={verify}>
      <FormField label="Mã xác thực"><input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" /></FormField>
      <Feedback message={message} kind="error" />
      <Button disabled={busy || resending || otp.length !== 6 || !email}>{busy ? 'Đang xác minh…' : 'Xác nhận'}</Button>
    </form>
    <Button variant="ghost" className="mt-3 w-full" disabled={!email || busy || resending || cooldown > 0} onClick={() => { void resend() }}>
      {resending ? 'Đang gửi mã…' : cooldown > 0 ? `Gửi lại mã sau ${formatOtpCountdown(cooldown)}` : 'Gửi lại mã'}
    </Button>
    <Feedback message={resendMessage} />
    {partner && <Link className="mt-3 block text-center text-sm font-semibold text-[#1E3A5F] hover:underline" to={partnerRegisterPath}>Quay lại đăng ký</Link>}
  </Card>
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return <Card className="p-7"><h1 className="text-2xl font-semibold">Quên mật khẩu</h1><p className="mt-2 text-sm text-slate-500">Nhập thư điện tử tài khoản để nhận mã đặt lại mật khẩu.</p><form className="mt-6 grid gap-4" onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(''); const normalizedEmail = email.trim().toLowerCase(); try { await repo.requestOtp(normalizedEmail); startOtpResendCooldown(normalizedEmail, 'password-reset'); navigate('/auth/reset-password?email=' + encodeURIComponent(normalizedEmail)) } catch (error) { setMessage(passwordResetErrorMessage(error)) } finally { setBusy(false) } }}><FormField label="Thư điện tử"><input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></FormField><Feedback message={message} kind="error" /><Button disabled={busy}>{busy ? 'Đang gửi...' : 'Gửi mã xác nhận'}</Button></form></Card>
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
  return <Card className="p-7"><h1 className="text-2xl font-semibold">Đặt lại mật khẩu</h1><p className="mt-2 text-sm text-slate-500">Tài khoản: {email || 'chưa chọn'}</p><form className="mt-6 grid gap-4" onSubmit={handleSubmit(async values => { try { await repo.resetPassword(email, values.password, values.otp); clearOtpResendCooldown(email, 'password-reset'); navigate('/dang-nhap?reset=1') } catch (error) { setMessage(errorMessage(error)) } })}><FormField label="Mã xác thực" error={errors.otp?.message}><input inputMode="numeric" autoComplete="one-time-code" {...register('otp')} /></FormField><FormField label="Mật khẩu mới" error={errors.password?.message}><input type="password" autoComplete="new-password" {...register('password')} /></FormField><FormField label="Xác nhận mật khẩu" error={errors.confirm?.message}><input type="password" autoComplete="new-password" {...register('confirm')} /></FormField><Feedback message={message} kind="error" /><Button disabled={isSubmitting || !email}>Lưu mật khẩu mới</Button></form><Feedback message={resendMessage} /><Button variant="ghost" className="mt-3 w-full" disabled={!email || resending || cooldown > 0} onClick={async () => { setResending(true); try { await repo.requestOtp(email); startOtpResendCooldown(email, 'password-reset'); setResendMessage(isMock ? 'Đã tạo lại mã xác thực.' : 'Mã đặt lại mật khẩu đã được gửi.'); setMessage('') } catch (error) { setResendMessage(''); setMessage(passwordResetErrorMessage(error)) } finally { setResending(false) } }}>{resending ? 'Đang gửi mã...' : cooldown > 0 ? `Gửi lại mã sau ${formatOtpCountdown(cooldown)}` : 'Gửi lại mã'}</Button></Card>
}
