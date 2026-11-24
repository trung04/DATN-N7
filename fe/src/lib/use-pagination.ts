import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { lastPage, PAGE_SIZE, PAGE_SIZES, readPage, readPageSize } from './pagination'

export function usePagination(total?: number) {
  const [params, setParams] = useSearchParams()
  const page = readPage(params)
  const size = readPageSize(params)
  const max = total === undefined ? undefined : lastPage(total, size)
  useEffect(() => {
    if ((params.has('page') && params.get('page') !== String(page)) || (max !== undefined && page > max) || (params.has('limit') && params.get('limit') !== String(size))) {
      setParams(current => {
        const next = new URLSearchParams(current)
        next.set('page', String(Math.min(page, max ?? page)))
        if (params.has('limit')) next.set('limit', String(size))
        return next
      }, { replace: true })
    }
  }, [params, setParams, page, max, size])
  const setPage = (value: number) => setParams(current => {
    const next = new URLSearchParams(current)
    next.set('page', String(Math.max(1, Math.min(value, max ?? value))))
    return next
  })
  const setSize = (value: number) => setParams(current => {
    const next = new URLSearchParams(current)
    next.set('limit', String(PAGE_SIZES.some(size => size === value) ? value : PAGE_SIZE))
    next.set('page', '1')
    return next
  })
  return { page, size, setPage, setSize }
}

