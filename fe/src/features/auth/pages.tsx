import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, Feedback, FormField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { demoAccounts, DEMO_PASSWORD } from '@/services/mock/seed'
import { isMock, repo } from '@/services'
import { errorMessage } from '@/lib/utils'
import { useSession } from '@/stores/session'
import { clearOtpResendCooldown, formatOtpCountdown, startOtpResendCooldown, useOtpResendCooldown } from './otp-cooldown'

const loginSchema = z.object({ username: z.string().min(1, 'Nhập tên đăng nhập hoặc email.'), password: z.string().min(1, 'Nhập mật khẩu.') })
const registerSchema = z.object({ name: z.string().min(2, 'Tên cần ít nhất 2 ký tự.'), username: z.string().min(3, 'Tên đăng nhập cần ít nhất 3 ký tự.').max(50).regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/, 'Chỉ dùng chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.'), email: z.email('Email không hợp lệ.'), password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.').regex(/[A-Za-z]/, 'Mật khẩu cần có chữ cái.').regex(/[0-9]/, 'Mật khẩu cần có chữ số.'), confirm: z.string() }).refine(x => x.password === x.confirm, { path: ['confirm'], message: 'Mật khẩu xác nhận không khớp.' })
const resetSchema = z.object({ otp: z.string().length(6, 'OTP gồm 6 chữ số.'), password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.').regex(/[A-Za-z]/).regex(/[0-9]/), confirm: z.string() }).refine(x => x.password === x.confirm, { path: ['confirm'], message: 'Mật khẩu xác nhận không khớp.' })
const authDestination = (role: string) => role === 'admin' ? '/admin' : role === 'partner' ? '/partner' : '/'
const apiErrorCode = (error: unknown): unknown => (error as { response?: { data?: { code?: unknown } } }).response?.data?.code

export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const login = useSession(s => s.login)
  const [message, setMessage] = useState('')
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '' } })
  return <Card className="p-7"><h1 className="text-2xl font-semibold">Đăng nhập</h1><p className="mt-2 text-sm text-slate-500">Tiếp tục khám phá và quản lý chuyến đi của bạn.</p><form className="mt-6 grid gap-4" onSubmit={handleSubmit(async values => { try { const user = await repo.login(values.username, values.password); login(user); const target = params.get('returnTo'); navigate(target?.startsWith('/') && !target.startsWith('//') ? target : authDestination(user.role), { replace: true }) } catch (error) { setMessage(errorMessage(error)) } })}><FormField label="Tên đăng nhập hoặc email" error={errors.username?.message}><input autoComplete="username" {...register('username')} /></FormField><FormField label="Mật khẩu" error={errors.password?.message}><input type="password" autoComplete="current-password" {...register('password')} /></FormField><div className="text-right"><Link className="text-sm font-semibold text-[#1E3A5F] hover:underline" to="/auth/forgot-password">Quên mật khẩu?</Link></div><Feedback message={message} kind="error" /><Button disabled={isSubmitting}>{isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</Button></form><Button variant="secondary" className="mt-3 w-full" disabled={isMock || !import.meta.env.VITE_API_BASE_URL} onClick={() => { window.location.href = import.meta.env.VITE_API_BASE_URL + '/auth/google/start' }}>Đăng nhập bằng Google</Button>{isMock && <p className="mt-2 text-xs text-slate-500">Google OAuth cần backend được cấu hình.</p>}{isMock && <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">Tài khoản demo · mật khẩu {DEMO_PASSWORD}</p><div className="mt-2 grid gap-1">{demoAccounts.map(account => <button key={account.email} className="text-left text-sm text-[#1E3A5F] hover:underline" onClick={() => { setValue('username', account.email); setValue('password', DEMO_PASSWORD) }} type="button">{account.role}: {account.email}</button>)}</div></div>}<p className="mt-6 text-center text-sm text-slate-600">Chưa có tài khoản? <Link className="font-semibold text-[#1E3A5F] hover:underline" to="/auth/register">Đăng ký</Link></p></Card>
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema), defaultValues: { name: '', username: '', email: '', password: '', confirm: '' } })
  return <Card className="p-7"><h1 className="text-2xl font-semibold">Tạo tài khoản du khách</h1><p className="mt-2 text-sm text-slate-500">Dùng tài khoản để lưu sở thích, lịch trình và đặt phòng.</p><form className="mt-6 grid gap-4" onSubmit={handleSubmit(async values => { const email = values.email.trim().toLowerCase(); try { await repo.register(values.name, values.username, email, values.password); startOtpResendCooldown(email, 'verification'); navigate('/auth/verify-otp?email=' + encodeURIComponent(email)) } catch (error) { if (apiErrorCode(error) === 'AUTH_EMAIL_DELIVERY_FAILED') { clearOtpResendCooldown(email, 'verification'); navigate('/auth/verify-otp?delivery=failed&email=' + encodeURIComponent(email)) } else setMessage(errorMessage(error)) } })}><FormField label="Họ tên" error={errors.name?.message}><input autoComplete="name" {...register('name')} /></FormField><FormField label="Tên đăng nhập" error={errors.username?.message}><input autoComplete="username" {...register('username')} /></FormField><FormField label="Email" error={errors.email?.message}><input type="email" autoComplete="email" {...register('email')} /></FormField><FormField label="Mật khẩu" error={errors.password?.message}><input type="password" autoComplete="new-password" {...register('password')} /></FormField><FormField label="Xác nhận mật khẩu" error={errors.confirm?.message}><input type="password" autoComplete="new-password" {...register('confirm')} /></FormField><Feedback message={message} kind="error" /><Button disabled={isSubmitting}>{isSubmitting ? 'Đang tạo...' : 'Tiếp tục xác thực'}</Button></form><Button variant="secondary" className="mt-3 w-full" disabled={isMock || !import.meta.env.VITE_API_BASE_URL} onClick={() => { window.location.href = import.meta.env.VITE_API_BASE_URL + '/auth/google/start' }}>Đăng ký bằng Google</Button>{isMock && <p className="mt-2 text-xs text-slate-500">Chế độ demo không gửi email thật.</p>}<p className="mt-6 text-center text-sm">Đã có tài khoản? <Link className="font-semibold text-[#1E3A5F]" to="/auth/login">Đăng nhập</Link></p></Card>
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
  return <Card className="p-7"><h1 className="text-2xl font-semibold">Xác thực tài khoản</h1><p className="mt-2 text-sm text-slate-500">Nhập mã 6 chữ số đã gửi đến {email || 'email của bạn'}.</p>{deliveryFailed && <Feedback message="Tài khoản đã được tạo nhưng email chưa gửi được. Hãy bấm Gửi lại mã để thử lại." kind="error" />}{isMock && <div className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Mã OTP demo: <strong>123456</strong>.</div>}<form className="mt-5 grid gap-4" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await repo.verifyOtp(email, otp); clearOtpResendCooldown(email, 'verification'); navigate('/auth/login?registered=1') } catch (error) { setMessage(errorMessage(error)) } finally { setBusy(false) } }}><FormField label="Mã OTP"><input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" /></FormField><Feedback message={message} kind="error" /><Button disabled={busy || otp.length !== 6 || !email}>Xác nhận</Button></form><Button variant="ghost" className="mt-3 w-full" disabled={!email || resending || cooldown > 0} onClick={async () => { setResending(true); try { await repo.resendOtp(email); startOtpResendCooldown(email, 'verification'); setMessage(isMock ? 'Đã tạo lại mã OTP demo.' : 'Nếu tài khoản đang chờ xác minh, mã mới sẽ được gửi qua email.'); setOtp(''); if (deliveryFailed) navigate('/auth/verify-otp?email=' + encodeURIComponent(email), { replace: true }) } catch (error) { setMessage(errorMessage(error)) } finally { setResending(false) } }}>{resending ? 'Đang gửi mã...' : cooldown > 0 ? `Gửi lại mã sau ${formatOtpCountdown(cooldown)}` : 'Gửi lại mã'}</Button></Card>
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return <Card className="p-7"><h1 className="text-2xl font-semibold">Quên mật khẩu</h1><p className="mt-2 text-sm text-slate-500">Nhập email tài khoản để nhận mã đặt lại mật khẩu.</p><form className="mt-6 grid gap-4" onSubmit={async e => { e.preventDefault(); setBusy(true); const normalizedEmail = email.trim().toLowerCase(); try { await repo.requestOtp(normalizedEmail); startOtpResendCooldown(normalizedEmail, 'password-reset'); navigate('/auth/reset-password?email=' + encodeURIComponent(normalizedEmail)) } catch (error) { setMessage(errorMessage(error)) } finally { setBusy(false) } }}><FormField label="Email"><input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></FormField><Feedback message={message} kind="error" /><Button disabled={busy}>{busy ? 'Đang gửi...' : 'Gửi mã xác nhận'}</Button></form>{isMock && <p className="mt-4 text-xs text-slate-500">Chế độ demo dùng mã 123456, không gửi email thật.</p>}</Card>
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
  return <Card className="p-7"><h1 className="text-2xl font-semibold">Đặt lại mật khẩu</h1><p className="mt-2 text-sm text-slate-500">Tài khoản: {email || 'chưa chọn'}</p>{isMock && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Mã demo: <strong>123456</strong></p>}<form className="mt-6 grid gap-4" onSubmit={handleSubmit(async values => { try { await repo.resetPassword(email, values.password, values.otp); clearOtpResendCooldown(email, 'password-reset'); navigate('/auth/login?reset=1') } catch (error) { setMessage(errorMessage(error)) } })}><FormField label="Mã OTP" error={errors.otp?.message}><input inputMode="numeric" autoComplete="one-time-code" {...register('otp')} /></FormField><FormField label="Mật khẩu mới" error={errors.password?.message}><input type="password" autoComplete="new-password" {...register('password')} /></FormField><FormField label="Xác nhận mật khẩu" error={errors.confirm?.message}><input type="password" autoComplete="new-password" {...register('confirm')} /></FormField><Feedback message={message} kind="error" /><Button disabled={isSubmitting || !email}>Lưu mật khẩu mới</Button></form><Feedback message={resendMessage} /><Button variant="ghost" className="mt-3 w-full" disabled={!email || resending || cooldown > 0} onClick={async () => { setResending(true); try { await repo.requestOtp(email); startOtpResendCooldown(email, 'password-reset'); setResendMessage(isMock ? 'Đã tạo lại mã OTP demo.' : 'Nếu email thuộc tài khoản hợp lệ, mã mới sẽ được gửi.'); setMessage('') } catch (error) { setResendMessage(''); setMessage(errorMessage(error)) } finally { setResending(false) } }}>{resending ? 'Đang gửi mã...' : cooldown > 0 ? `Gửi lại mã sau ${formatOtpCountdown(cooldown)}` : 'Gửi lại mã'}</Button></Card>
}
