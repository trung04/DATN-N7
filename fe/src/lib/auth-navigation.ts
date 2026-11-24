export function localReturnPath(returnTo: string | null): string | null {
  if (!returnTo?.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('\\')) return null
  return returnTo
}

export function loginDestination(role: string, returnTo: string | null) {
  if (role === 'partner') return '/partner'
  return localReturnPath(returnTo) ?? (role === 'admin' ? '/admin' : '/')
}
