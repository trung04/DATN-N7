import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { PlannerResult, User } from '@/types/domain'

interface SessionState {
  user: User | null
  draft: PlannerResult | null
  login: (user: User) => void
  logout: () => void
  setDraft: (draft: PlannerResult | null) => void
}

export const useSession = create<SessionState>()(persist(
  set => ({
    user: null,
    draft: null,
    login: user => set({ user }),
    logout: () => set({ user: null }),
    setDraft: draft => set({ draft }),
  }),
  { name: 'smarttravel.session', storage: createJSONStorage(() => sessionStorage) },
))
