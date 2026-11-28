import { useState, type FormEvent } from 'react'
import type { SetURLSearchParams } from 'react-router'

export function useSearchDraft<T extends object>(applied: T, source = JSON.stringify(applied)) {
  const [draft, setDraft] = useState<{ source: string; values: T } | null>(null)

  return {
    values: draft?.source === source ? draft.values : applied,
    change: (patch: Partial<T>) => setDraft(current => ({
      source,
      values: { ...(current?.source === source ? current.values : applied), ...patch },
    })),
    reset: () => setDraft(null),
  }
}

export function useSearchFilters<T extends Record<string, string>>(
  params: URLSearchParams,
  setParams: SetURLSearchParams,
  applied: T,
) {
  const draft = useSearchDraft(applied)

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = new URLSearchParams(params)
    for (const [key, raw] of Object.entries(draft.values)) {
      const value = raw.trim()
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('page')
    draft.reset()
    if (next.toString() !== params.toString()) setParams(next)
  }

  return { filters: draft.values, changeFilters: draft.change, applyFilters, resetFilters: draft.reset }
}
