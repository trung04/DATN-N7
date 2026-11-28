export function normalizeVietnamesePhone(value: string): string | null {
  const trimmed = value.trim()
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null

  const compact = trimmed.replace(/[\s().-]/g, '')
  const domestic = compact.replace(/^(?:\+84|0084|84)(?=[1-9])/, '0')
  return /^0(?:[35789]\d{8}|2\d{9})$/.test(domestic) ? domestic : null
}
