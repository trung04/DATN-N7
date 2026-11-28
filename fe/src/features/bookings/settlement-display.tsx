import type { SettlementBatch, SettlementStatus } from '@/types/domain'
import { settlementStatusLabel } from './settlement-format'

const tones: Record<SettlementStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  APPROVED: 'bg-amber-50 text-amber-900',
  PROCESSING: 'bg-sky-50 text-sky-900',
  PAID: 'bg-emerald-50 text-emerald-800',
  FAILED: 'bg-red-50 text-red-800',
}

export function SettlementBadge({ batch }: { batch: SettlementBatch }) {
  const simulated = batch.transferMode === 'LEGACY_SIMULATED'
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${simulated ? tones.DRAFT : tones[batch.status]}`}>
    {settlementStatusLabel(batch.status, simulated)}
  </span>
}
