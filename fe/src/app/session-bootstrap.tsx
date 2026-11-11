import { useEffect, type ReactNode } from 'react'
import { LoadingState } from '@/components/common'
import { isMock, repo } from '@/services'
import { useSession } from '@/stores/session'

export function SessionBootstrap({ children }: { children: ReactNode }) {
  const authReady = useSession(state => state.authReady)
  const login = useSession(state => state.login)
  const logout = useSession(state => state.logout)
  const markAuthReady = useSession(state => state.markAuthReady)

  useEffect(() => {
    let active = true
    const clearSession = () => { if (active) logout() }
    window.addEventListener('smarttravel:unauthorized', clearSession)

    if (isMock) {
      markAuthReady()
    } else {
      void repo.currentUser()
        .then(user => { if (active && user) login(user) })
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
