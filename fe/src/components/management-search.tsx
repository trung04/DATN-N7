import type { ComponentProps } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ManagementSearch(props: Omit<ComponentProps<'input'>, 'type'>) {
  return <span className="management-search">
    <Search aria-hidden="true" size={17} />
    <input {...props} type="search" />
  </span>
}

export function SearchButton({ className }: { className?: string }) {
  return <Button type="submit" size="sm" className={className}><Search aria-hidden="true" size={16} />Tìm kiếm</Button>
}
