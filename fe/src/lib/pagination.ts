export const PAGE_SIZES = [6, 10, 15, 20] as const
export const PAGE_SIZE = 6

export function readPageSize(params: URLSearchParams, defaultSize = PAGE_SIZE) {
  const size = Number(params.get('limit') ?? defaultSize)
  return PAGE_SIZES.some(value => value === size) ? size : defaultSize
}

export function readPage(params: URLSearchParams, key = 'page') {
  const value = Number(params.get(key) ?? 1)
  return Number.isSafeInteger(value) && value > 0 && value <= 1_000_000 ? value : 1
}

export function lastPage(total: number, size = PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / size))
}

export function pageItems<T>(items: T[], page: number, size = PAGE_SIZE) {
  const current = Math.min(page, lastPage(items.length, size))
  return items.slice((current - 1) * size, current * size)
}

export interface DataPage<T> { data: T[]; meta: { page: number; limit: number; total: number } }

// Exhaust paged option lists instead of silently keeping only the first 100.
export async function fetchAllPages<T>(fetchPage: (page: number) => Promise<DataPage<T>>): Promise<T[]> {
  const first = await fetchPage(1)
  const items = [...first.data]
  const pages = lastPage(first.meta.total, first.meta.limit)
  for (let start = 2; start <= pages; start += 4) {
    const batch = await Promise.all(Array.from({ length: Math.min(4, pages - start + 1) }, (_, offset) => fetchPage(start + offset)))
    items.push(...batch.flatMap(page => page.data))
  }
  return items
}
