import { useRef, useState, type FormEvent } from 'react'
import { Check, ChevronDown, Landmark } from 'lucide-react'
import { ManagementSearch, SearchButton } from '@/components/management-search'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { DialogPagination } from '@/components/ui/dialog-sections'
import type { BankOption } from '@/types/domain'

const banksPerPage = 5

function normalizeSearch(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '')
}

export function BankPicker({ banks, selected, onSelect }: {
  banks: BankOption[]
  selected?: BankOption
  onSelect: (bank: BankOption) => void
}) {
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const results = useRef<HTMLDivElement>(null)
  const matches = banks.filter(bank => [bank.code, bank.shortName, bank.name].some(value => normalizeSearch(value).includes(search)))
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matches.length / banksPerPage) - 1))
  const first = currentPage * banksPerPage

  function goToPage(next: number) {
    setPage(next)
    results.current?.scrollTo({ top: 0 })
  }

  function searchBanks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // A submit in this portal must not submit the surrounding payment form.
    event.stopPropagation()
    setSearch(normalizeSearch(draft))
    goToPage(0)
  }

  return <div className="min-w-0">
    <div className="mb-1.5 text-sm font-medium text-slate-700">Ngân hàng</div>
    <Dialog onOpenChange={open => {
      if (open) {
        setDraft('')
        setSearch('')
        setPage(0)
      }
    }}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" aria-label={selected ? `Đổi ngân hàng, ${selected.shortName} đã chọn` : 'Chọn ngân hàng'}
          className="h-auto min-h-11 w-full justify-between gap-3 py-1.5 text-left">
          <span className="flex min-w-0 items-center gap-3">
            {selected ? <BankLogo key={selected.bin} bank={selected} /> : <Landmark size={18} className="shrink-0" aria-hidden="true" />}
            <span className="wrap-anywhere">{selected?.shortName ?? 'Chọn ngân hàng'}</span>
          </span>
          <ChevronDown size={17} className="shrink-0" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent title="Chọn ngân hàng" layout="workspace" className="h-[min(33rem,calc(100dvh-1rem))] max-w-xl"
        bodyClassName="flex flex-1 flex-col overflow-hidden"
        footer={<div className="w-full"><DialogPagination label="Phân trang ngân hàng"
          page={currentPage} pageSize={banksPerPage} total={matches.length} onChange={goToPage} alwaysVisible /></div>}>
        <form aria-label="Tìm kiếm ngân hàng" onSubmit={searchBanks} className="mb-3 flex shrink-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <ManagementSearch aria-label="Tìm ngân hàng" placeholder="Tên hoặc viết tắt"
              value={draft} onChange={event => setDraft(event.target.value)} />
          </div>
          <SearchButton className="h-10 shrink-0" />
        </form>
        <div ref={results} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {matches.length === 0
            ? <p className="grid h-full place-items-center rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-600">Không tìm thấy ngân hàng phù hợp.</p>
            : <ul className="grid gap-1">
              {matches.slice(first, first + banksPerPage).map(bank => {
                const isSelected = selected?.bin === bank.bin
                return <li key={bank.bin}>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost" onClick={() => onSelect(bank)} aria-pressed={isSelected}
                      className="h-auto min-h-14 w-full justify-start gap-3 rounded-lg px-2.5 py-2 text-left aria-pressed:bg-sky-50 aria-pressed:text-[#1E3A5F]">
                      <BankLogo bank={bank} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{bank.shortName}</span>
                        <span className="block wrap-anywhere text-xs font-normal text-slate-600">{bank.name}</span>
                      </span>
                      <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">{isSelected && <Check size={17} />}</span>
                    </Button>
                  </DialogClose>
                </li>
              })}
            </ul>}
        </div>
      </DialogContent>
    </Dialog>
  </div>
}

function BankLogo({ bank }: { bank: BankOption }) {
  const [failed, setFailed] = useState(false)

  // PNGs from the VietQR bank catalog, stored under their BIN in public/bank-logos.
  return <span className="grid h-10 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white p-0.5" aria-hidden="true">
    {failed ? <span className="text-[10px] font-semibold leading-none text-[#1E3A5F]">{bank.code}</span>
      : <img src={`/bank-logos/${bank.bin}.png`} alt="" width={64} height={40} className="h-full w-full object-contain"
        onError={() => setFailed(true)} />}
  </span>
}
