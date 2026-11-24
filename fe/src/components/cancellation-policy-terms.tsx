import type { CancellationPolicyTier } from '@/types/domain'

export function CancellationPolicyTerms({ tiers, cancelHours = 0, penaltyPercent = 0, cancellationAllowed = true, description }: {
  tiers?: CancellationPolicyTier[]
  cancelHours?: number
  penaltyPercent?: number
  cancellationAllowed?: boolean
  description?: string | null
}) {
  const fee = (percent: number | null) => percent === null
    ? 'Không được hủy'
    : percent === 0 ? 'Miễn phí hủy' : `Phí hủy ${percent.toLocaleString('vi-VN')}%`

  const periods = tiers ? tiers.map((tier, index) => {
    const previous = tiers[index - 1]?.upToHours
    const limit = tier.upToHours
    const label = previous === undefined
      ? limit === null ? 'Kể từ lúc đặt phòng' : `Từ lúc đặt đến hết ${limit} giờ`
      : limit === null ? `Sau ${previous} giờ` : `Trên ${previous} đến hết ${limit} giờ`
    return { label, fee: fee(tier.feePercent) }
  }) : cancellationAllowed && cancelHours > 0 ? [
    { label: `Trước ${cancelHours} giờ kể từ lúc đặt`, fee: fee(0) },
    { label: `Từ ${cancelHours} giờ kể từ lúc đặt`, fee: fee(penaltyPercent) },
  ] : [{ label: 'Kể từ lúc đặt phòng', fee: fee(cancellationAllowed ? penaltyPercent : null) }]

  return <div className="min-w-0 text-sm text-slate-700">
    <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white px-3">
      {periods.map(period => <div key={period.label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5">
        <dt>{period.label}</dt>
        <dd className="font-semibold text-slate-900">{period.fee}</dd>
      </div>)}
    </dl>
    {description && <p className="mt-2 leading-relaxed wrap-anywhere whitespace-pre-wrap text-slate-600">{description}</p>}
  </div>
}
