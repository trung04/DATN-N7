import { useEffect, useRef, type ReactNode } from 'react'
import { LoadingState } from '@/components/common'
import { isMock, repo } from '@/services'
import { useSession } from '@/stores/session'

export function SessionBootstrap({ children }: { children: ReactNode }) {
  const authReady = useSession(state => state.authReady)
  const login = useSession(state => state.login)
  const logout = useSession(state => state.logout)
  const markAuthReady = useSession(state => state.markAuthReady)
  const sessionRequest = useRef<ReturnType<typeof repo.currentUser> | null>(null)

  useEffect(() => {
    let active = true
    const clearSession = () => { if (active) logout() }
    window.addEventListener('smarttravel:unauthorized', clearSession)

    if (isMock) {
      markAuthReady()
    } else {
      sessionRequest.current ??= repo.currentUser()
      void sessionRequest.current
        .then(user => {
          if (!active) return
          if (user) login(user)
          else logout()
        })
        .catch(clearSession)
        .finally(() => { if (active) markAuthReady() })
    }

    return () => {
      active = false
      window.removeEventListener('smarttravel:unauthorized', clearSession)
    }
  }, [login, logout, markAuthReady])

  if (!authReady) return <LoadingState />
  return children
}
