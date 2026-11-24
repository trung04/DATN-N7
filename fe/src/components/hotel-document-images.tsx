import { apiAssetUrl } from '@/services/api/client'
import type { PartnerHotelDocument } from '@/types/domain'

export function HotelDocumentImages({ document }: { document: PartnerHotelDocument }) {
  return document.files?.length ? <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">{document.files.map((file, index) => <a key={file.id} className="overflow-hidden rounded-lg border border-slate-200" href={apiAssetUrl(file.url)} target="_blank" rel="noreferrer">
    <img src={apiAssetUrl(file.url)} alt={`Ảnh giấy tờ ${document.documentNumber} — ${index + 1}`} className="aspect-[4/3] w-full bg-slate-50 object-contain" loading="lazy" />
    <span className="block p-2 text-center text-xs text-[#1E3A5F]">Xem ảnh {index + 1}</span>
  </a>)}</div> : <a className="mt-2 block break-all text-sm text-[#1E3A5F] underline" href={apiAssetUrl(document.fileUrl)} target="_blank" rel="noreferrer">Mở giấy tờ</a>
}
