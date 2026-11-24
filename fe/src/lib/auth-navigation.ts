export function loginDestination(role: string, returnTo: string | null) {
  if (role === 'partner') return '/partner'
  if (returnTo?.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\')) return returnTo
  return role === 'admin' ? '/admin' : '/'
}
