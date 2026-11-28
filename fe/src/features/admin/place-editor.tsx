import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ImageIcon, Upload, X } from 'lucide-react'
import { Feedback, FormField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { apiAssetUrl } from '@/services/api/client'
import type { PlaceAdminInput, PlaceAdminRequest, PlaceCatalogOptions, PlaceStatus } from '@/types/domain'

const steps = ['Thông tin', 'Vị trí', 'Chủ đề', 'Giá', 'Ảnh']
const acceptedImages = ['image/jpeg', 'image/png', 'image/webp']
const imageUrlPattern = /^(https?:\/\/|\/images\/)[^\s]+$/i
const emptyPrice = { minPrice: 0, maxPrice: 0, currency: 'VND', pricingUnit: 'người', description: '' }
const optionalText = (value: string) => value.trim() || null

interface PlaceEditorProps {
  initial: PlaceAdminInput
  editing: boolean
  options: PlaceCatalogOptions
  busy: boolean
  error: string
  onClose: () => void
  onSave: (input: PlaceAdminRequest, file?: File) => Promise<void>
}

export function PlaceEditor({ initial, editing, options, busy, error, onClose, onSave }: PlaceEditorProps) {
  const [form, setForm] = useState(initial)
  const [step, setStep] = useState(0)
  const [upload, setUpload] = useState<{ file: File; preview: string }>()
  const [imageError, setImageError] = useState('')
  const [stepError, setStepError] = useState('')
  const [useLink, setUseLink] = useState(false)
  const [coverUnavailable, setCoverUnavailable] = useState('')
  const lastStep = step === steps.length - 1
  const price = form.referencePrice
  const isStoredImage = form.imageUrl?.startsWith('/api/')
  const imageUrl = form.imageUrl?.trim() ?? ''
  const preview = upload?.preview ?? (isStoredImage ? apiAssetUrl(imageUrl) : imageUrlPattern.test(imageUrl) ? imageUrl : '')

  useEffect(() => () => {
    if (upload) URL.revokeObjectURL(upload.preview)
  }, [upload])

  function field<K extends keyof PlaceAdminInput>(key: K, value: PlaceAdminInput[K]) {
    setForm(current => ({ ...current, [key]: value }))
    setStepError('')
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!acceptedImages.includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setImageError('Hãy chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.')
      return
    }
    setImageError('')
    setUseLink(false)
    setUpload({ file, preview: URL.createObjectURL(file) })
  }

  function changeStep(next: number) {
    setStepError('')
    setStep(next)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (step === 0 && (!form.name.trim() || !form.city.trim())) {
      setStepError('Nhập tên điểm đến và thành phố.')
      return
    }
    if (step === 3 && price && (price.maxPrice < price.minPrice || !price.pricingUnit.trim())) {
      setStepError('Nhập đơn vị tính và giá cao nhất lớn hơn hoặc bằng giá thấp nhất.')
      return
    }
    if (!lastStep) {
      changeStep(step + 1)
      return
    }
    if (imageError) return
    if (imageUrl && !isStoredImage && !imageUrlPattern.test(imageUrl) && !upload) {
      setStepError('Nhập đường dẫn ảnh bắt đầu bằng https://, http:// hoặc /images/.')
      return
    }

    const { imageUrl: currentImage, ...fields } = form
    const input: PlaceAdminRequest = {
      ...fields,
      name: form.name.trim(),
      city: form.city.trim(),
      address: optionalText(form.address),
      description: optionalText(form.description),
      countryCode: form.countryCode.trim().toUpperCase(),
      provinceCode: form.provinceCode.trim().toUpperCase(),
      timezone: form.timezone.trim(),
      openingTime: optionalText(form.openingTime),
      imageAltText: optionalText(form.imageAltText ?? ''),
      referencePrice: price ? { ...price, pricingUnit: price.pricingUnit.trim(), description: price.description.trim() } : null,
      ...(!upload && currentImage !== initial.imageUrl ? { imageUrl: imageUrl || null } : {}),
    }
    void onSave(input, upload?.file)
  }

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <DialogContent title={editing ? 'Chỉnh sửa điểm đến' : 'Thêm điểm đến'} className="place-editor flex max-w-[760px] flex-col overflow-hidden">
      <nav aria-label="Các bước nhập điểm đến" className="place-editor-steps grid shrink-0 grid-cols-5 gap-1 rounded-lg bg-slate-100 p-1">
        {steps.map((label, index) => <button key={label} type="button" aria-current={step === index ? 'step' : undefined}
          disabled={busy || index >= step} onClick={() => changeStep(index)}
          className={`rounded-md px-0.5 ${step === index ? 'bg-white text-[#1E3A5F] shadow-sm' : index < step ? 'text-slate-700 hover:bg-white/70' : 'text-slate-500'}`}>
          {label}
        </button>)}
      </nav>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div key={step} className="place-editor-panel min-h-0 flex-1 overflow-y-auto px-1" role="group" aria-label={steps[step]}>
          {step === 0 && <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:gap-x-4">
            <FormField label="Tên điểm đến"><input required maxLength={200} value={form.name} onChange={event => field('name', event.target.value)} /></FormField>
            <FormField label="Thành phố"><input required maxLength={120} value={form.city} onChange={event => field('city', event.target.value)} /></FormField>
            <FormField label="Loại hình"><select required value={form.categoryCode} onChange={event => field('categoryCode', event.target.value)}><option value="">Chọn loại hình</option>{options.categories.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></FormField>
            <FormField label="Trạng thái"><select value={form.status} onChange={event => field('status', event.target.value as PlaceStatus)}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></FormField>
            <div className="col-span-2"><FormField label="Mô tả"><textarea rows={2} maxLength={10000} value={form.description} onChange={event => field('description', event.target.value)} /></FormField></div>
          </div>}
          {step === 1 && <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:gap-x-4">
            <FormField label="Tỉnh/thành (mã)"><input required pattern="[A-Za-z0-9\-]{1,20}" maxLength={20} placeholder="DN" value={form.provinceCode} onChange={event => field('provinceCode', event.target.value.toUpperCase())} /></FormField>
            <FormField label="Múi giờ"><input required maxLength={100} value={form.timezone} onChange={event => field('timezone', event.target.value)} /></FormField>
            <FormField label="Vĩ độ"><input required type="number" min={-90} max={90} step="0.0000001" value={Number.isNaN(form.latitude) ? '' : form.latitude} onChange={event => field('latitude', event.target.valueAsNumber)} /></FormField>
            <FormField label="Kinh độ"><input required type="number" min={-180} max={180} step="0.0000001" value={Number.isNaN(form.longitude) ? '' : form.longitude} onChange={event => field('longitude', event.target.valueAsNumber)} /></FormField>
            <FormField label="Địa chỉ"><input maxLength={500} value={form.address} onChange={event => field('address', event.target.value)} /></FormField>
            <FormField label="Giờ mở cửa / ghi chú"><input maxLength={255} placeholder="Ví dụ 07:00–17:30" value={form.openingTime} onChange={event => field('openingTime', event.target.value)} /></FormField>
          </div>}
          {step === 2 && <fieldset>
            <legend className="mb-3 text-sm font-medium text-slate-700">Chọn tối đa 20 chủ đề</legend>
            <div className="flex flex-wrap gap-2">
              {options.topics.map(topic => {
                const checked = form.topicCodes.includes(topic.code)
                return <label key={topic.code} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-[#1E3A5F]/30 bg-slate-100 text-[#1E3A5F]' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={checked} disabled={!checked && form.topicCodes.length >= 20} onChange={event => field('topicCodes', event.target.checked ? [...form.topicCodes, topic.code] : form.topicCodes.filter(code => code !== topic.code))} />{topic.name}
                </label>
              })}
            </div>
          </fieldset>}
          {step === 3 && <div className="grid gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={Boolean(price)} onChange={event => field('referencePrice', event.target.checked ? initial.referencePrice ?? emptyPrice : null)} />Có giá tham khảo</label>
            {price && <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:gap-x-4">
              <FormField label={`Giá thấp nhất (${price.currency})`}><input required type="number" min={0} step="0.01" value={Number.isNaN(price.minPrice) ? '' : price.minPrice} onChange={event => field('referencePrice', { ...price, minPrice: event.target.valueAsNumber })} /></FormField>
              <FormField label={`Giá cao nhất (${price.currency})`}><input required type="number" min={0} step="0.01" value={Number.isNaN(price.maxPrice) ? '' : price.maxPrice} onChange={event => field('referencePrice', { ...price, maxPrice: event.target.valueAsNumber })} /></FormField>
              <FormField label="Đơn vị tính"><input required maxLength={60} value={price.pricingUnit} onChange={event => field('referencePrice', { ...price, pricingUnit: event.target.value })} /></FormField>
              <FormField label="Ghi chú về giá"><input maxLength={2000} value={price.description} onChange={event => field('referencePrice', { ...price, description: event.target.value })} /></FormField>
            </div>}
          </div>}
          {lastStep && <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-5">
            <div data-link-mode={useLink || undefined} className="place-editor-cover grid place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
              {preview && preview !== coverUnavailable ? <img key={preview} src={preview} alt="Xem trước ảnh điểm đến" className="h-full w-full object-cover" onError={() => setCoverUnavailable(preview)} /> : <div className="grid justify-items-center gap-1 text-xs"><ImageIcon size={24} aria-hidden="true" />{preview ? 'Không tải được ảnh xem trước' : 'Chưa có ảnh'}</div>}
            </div>
            <div className="grid min-w-0 content-start gap-2">
              <div className="place-editor-photo-actions flex flex-wrap items-center gap-x-3 gap-y-1">
                <label className="relative inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-[#1E3A5F] hover:bg-slate-50 focus-within:ring-2 focus-within:ring-[#1E3A5F]">
                  <Upload size={16} aria-hidden="true" />{upload ? 'Đổi tệp' : 'Chọn tệp ảnh'}
                  <input type="file" aria-label="Chọn tệp ảnh" accept={acceptedImages.join(',')} onChange={selectImage} disabled={busy} className="place-editor-file" />
                </label>
                <button type="button" className="text-sm font-semibold text-[#1E3A5F] hover:underline" aria-expanded={useLink} onClick={() => { setUseLink(!useLink); setImageError('') }}>Dùng đường dẫn</button>
                {(upload || imageUrl || imageError) && <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline" onClick={() => {
                  if (upload || imageError) setUpload(undefined)
                  else field('imageUrl', null)
                  setImageError('')
                }}><X size={14} aria-hidden="true" />{upload || imageError ? 'Bỏ chọn' : 'Xóa ảnh'}</button>}
              </div>
              {imageError ? <p role="status" className="text-xs text-red-700">{imageError}</p> : <p className="truncate text-xs text-slate-500" title={upload?.file.name}>{upload?.file.name ?? 'JPG, PNG hoặc WebP · tối đa 5 MB'}</p>}
              {useLink && <FormField label="Đường dẫn ảnh"><input maxLength={2000} placeholder="https://…" value={isStoredImage ? '' : imageUrl} onChange={event => { setUpload(undefined); field('imageUrl', event.target.value) }} /></FormField>}
              <FormField label="Mô tả ảnh"><input maxLength={255} value={form.imageAltText ?? ''} onChange={event => field('imageAltText', event.target.value)} /></FormField>
            </div>
          </div>}
        </div>
        <div className="shrink-0 border-t border-slate-200 pt-2">
          <Feedback message={stepError || (lastStep ? error : '')} kind="error" />
          <div className="flex justify-between gap-2 pt-1">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => { if (step) changeStep(step - 1); else onClose() }}>{step > 0 ? <><ArrowLeft size={16} />Quay lại</> : 'Hủy'}</Button>
            <Button type="submit" disabled={busy || (lastStep && Boolean(imageError))}>{lastStep ? (busy ? 'Đang lưu…' : 'Lưu điểm đến') : <>Tiếp tục<ArrowRight size={16} /></>}</Button>
          </div>
        </div>
      </form>
    </DialogContent>
  </Dialog>
}
