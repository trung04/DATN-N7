import { useState, type ReactNode } from 'react'
import { Pagination } from '@/components/pagination'
import { lastPage, pageItems, PAGE_SIZE } from '@/lib/pagination'

export function PaginatedList<T>({ items, label, children }: {
  items: T[]
  label: string
  children: (visible: T[], offset: number) => ReactNode
}) {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(PAGE_SIZE)
  const current = Math.min(page, lastPage(items.length, size))
  return <>
    {children(pageItems(items, current, size), (current - 1) * size)}
    {items.length > PAGE_SIZE && <Pagination label={label} page={current} total={items.length}
      onPageChange={setPage} size={size} onSizeChange={value => { setSize(value); setPage(1) }} />}
  </>
}
