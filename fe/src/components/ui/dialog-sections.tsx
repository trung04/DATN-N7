import * as Tabs from '@radix-ui/react-tabs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from './button'

type Section = { id: string; label: string; content: ReactNode }

export function DialogSections({ label, sections }: { label: string; sections: [Section, ...Section[]] }) {
  return <Tabs.Root defaultValue={sections[0].id} className="min-w-0">
    <Tabs.List aria-label={label} className="sticky top-0 z-10 mb-3 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 sm:mb-4">
      {sections.map(section => <Tabs.Trigger
        key={section.id}
        value={section.id}
        className="min-h-9 flex-1 whitespace-nowrap rounded-md px-1.5 py-1.5 text-xs! font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-700 data-[state=active]:bg-white data-[state=active]:text-[#1e3a5f] data-[state=active]:shadow-sm sm:flex-none sm:px-4 sm:text-sm!"
      >{section.label}</Tabs.Trigger>)}
    </Tabs.List>
    {sections.map(section => <Tabs.Content key={section.id} value={section.id} className="min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-sky-700">
      {section.content}
    </Tabs.Content>)}
  </Tabs.Root>
}

export function DialogList({ items, label, pageSize }: { items: ReactNode[]; label: string; pageSize: number }) {
  const [page, setPage] = useState(0)
  const lastPage = Math.max(0, Math.ceil(items.length / pageSize) - 1)
  const currentPage = Math.min(page, lastPage)
  const start = currentPage * pageSize

  return <>
    <ul className="divide-y divide-slate-200">{items.slice(start, start + pageSize)}</ul>
    <DialogPagination label={label} page={currentPage} pageSize={pageSize} total={items.length} onChange={setPage} />
  </>
}

export function DialogPagination({ label, page, pageSize, total, onChange, alwaysVisible = false }: {
  label: string; page: number; pageSize: number; total: number; onChange: (page: number) => void; alwaysVisible?: boolean
}) {
  if (!alwaysVisible && total <= pageSize) return null
  const start = page * pageSize
  return <nav aria-label={label} className="flex items-center justify-end gap-2 py-1 text-sm text-slate-600">
    <span aria-live="polite" className={alwaysVisible ? 'mr-auto tabular-nums' : 'tabular-nums'}>
      {total > 0 ? `${start + 1}–${Math.min(start + pageSize, total)} / ${total}` : '0 kết quả'}
    </span>
    <Button type="button" variant="secondary" size="sm" aria-label="Trang trước" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></Button>
    <Button type="button" variant="secondary" size="sm" aria-label="Trang sau" disabled={start + pageSize >= total} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></Button>
  </nav>
}
