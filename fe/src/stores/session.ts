import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { PlannerResult, User } from '@/types/domain'

interface SessionState {
  user: User | null
  draft: PlannerResult | null
  authReady: boolean
  login: (user: User) => void
  logout: () => void
  markAuthReady: () => void
  setDraft: (draft: PlannerResult | null) => void
}

export const useSession = create<SessionState>()(persist(
  set => ({
    user: null,
    draft: null,
    authReady: false,
    login: user => set(state => ({
      user,
      authReady: true,
      draft: state.draft?.trip.userId && state.draft.trip.userId !== user.id ? null : state.draft,
    })),
    logout: () => set(state => ({
      user: null,
      authReady: true,
      draft: state.draft?.trip.userId ? null : state.draft,
    })),
    markAuthReady: () => set({ authReady: true }),
    setDraft: draft => set({ draft }),
  }),
  {
    name: 'smarttravel.session',
    storage: createJSONStorage(() => sessionStorage),
    partialize: state => ({ user: state.user, draft: state.draft }),
  },
))
