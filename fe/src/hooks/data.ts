import { useQuery } from '@tanstack/react-query'
import { repo } from '@/services'
import { useSession } from '@/stores/session'

export const useCatalog = () => useQuery({ queryKey: ['catalog'], queryFn: repo.publicData })
export function useTourist() {
  const user = useSession(s => s.user)
  return useQuery({ queryKey: ['tourist', user?.id], queryFn: () => repo.touristData(user?.id ?? ''), enabled: user?.role === 'tourist' })
}
export function usePartnerData() {
  const user = useSession(s => s.user)
  return useQuery({ queryKey: ['partner', user?.id], queryFn: () => repo.partnerData(user?.id ?? ''), enabled: user?.role === 'partner' })
}
export const useAdminData = () => useQuery({ queryKey: ['admin'], queryFn: repo.adminData })
