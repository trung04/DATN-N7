import { useEffect, useState } from 'react'

const OTP_RESEND_COOLDOWN_SECONDS = 60

function cooldownKey(email: string, purpose: 'verification' | 'password-reset') {
  return `auth:otp-resend:${purpose}:${email.trim().toLowerCase()}`
}

export function startOtpResendCooldown(email: string, purpose: 'verification' | 'password-reset') {
  if (!email) return
  const key = cooldownKey(email, purpose)
  sessionStorage.setItem(key, String(Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000))
  window.dispatchEvent(new CustomEvent('auth-otp-cooldown-updated', { detail: key }))
}

export function clearOtpResendCooldown(email: string, purpose: 'verification' | 'password-reset') {
  if (!email) return
  sessionStorage.removeItem(cooldownKey(email, purpose))
}

export function useOtpResendCooldown(
  email: string,
  purpose: 'verification' | 'password-reset',
  enabled = true,
) {
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (!email || !enabled) {
      setSecondsLeft(0)
      return
    }

    const key = cooldownKey(email, purpose)
    const storedDeadline = sessionStorage.getItem(key)
    let deadline = Number(storedDeadline)
    if (!storedDeadline) {
      deadline = Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000
      sessionStorage.setItem(key, String(deadline))
    }

    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) sessionStorage.removeItem(key)
    }

    const handleCooldownUpdated = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== key) return
      deadline = Number(sessionStorage.getItem(key)) || 0
      update()
    }

    update()
    const interval = window.setInterval(update, 1000)
    window.addEventListener('auth-otp-cooldown-updated', handleCooldownUpdated)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('auth-otp-cooldown-updated', handleCooldownUpdated)
    }
  }, [email, purpose, enabled])

  return secondsLeft
}

export function formatOtpCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainder = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}
