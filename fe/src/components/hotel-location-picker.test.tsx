import { useState } from 'react'
import { cleanup, render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HotelLocationPicker } from './hotel-location-picker'
import { searchHotelLocations } from '@/lib/hotel-location-search'
import type { HotelCoordinates } from '@/lib/coordinates'

const mocks = vi.hoisted(() => ({ mapEvents: {} as Record<string, (event: { lngLat: { wrap: () => { lat: number; lng: number } } }) => void> }))
vi.mock('mapbox-gl', () => ({ default: {
  supported: () => true,
  Map: class {
    addControl() {} resize() {} remove() {} easeTo() {} flyTo() {}
    getZoom() { return 4 }
    getCenter() { return { lng: 108, lat: 16 } }
    once(_event: string, callback: () => void) { callback() }
    on(event: string, callback: typeof mocks.mapEvents[string]) { mocks.mapEvents[event] = callback }
  },
  Marker: class { setLngLat() { return this } addTo() { return this } remove() {} on() {} },
  NavigationControl: class {},
} }))
vi.mock('@/lib/hotel-location-search', () => ({ searchHotelLocations: vi.fn() }))

function Form({ disabled = false, address = '1 Beach Road' }: { disabled?: boolean; address?: string }) {
  const [point, setPoint] = useState<HotelCoordinates>({ latitude: null, longitude: null })
  return <HotelLocationPicker {...point} address={address} disabled={disabled} onChange={setPoint} />
}
beforeEach(() => {
  vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', 'test-token')
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  mocks.mapEvents = {}
})
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('Hotel location picker', () => {
  it('starts without a marker value, accepts a real map click and clears both coordinates together', async () => {
    const user = userEvent.setup()
    render(<Form />)
    expect(screen.getByLabelText('Vĩ độ khách sạn')).toHaveValue(null)
    expect(screen.getByLabelText('Kinh độ khách sạn')).toHaveValue(null)
    act(() => mocks.mapEvents.click!({ lngLat: { wrap: () => ({ lat: 16.0614, lng: 108.2468 }) } }))
    expect(screen.getByLabelText('Vĩ độ khách sạn')).toHaveValue(16.0614)
    expect(screen.getByLabelText('Kinh độ khách sạn')).toHaveValue(108.2468)
    await user.click(screen.getByRole('button', { name: 'Xóa vị trí' }))
    expect(screen.getByLabelText('Vĩ độ khách sạn')).toHaveValue(null)
    expect(screen.getByLabelText('Kinh độ khách sạn')).toHaveValue(null)
  })

  it('requires a complete coordinate pair and preserves valid zero values', async () => {
    const user = userEvent.setup()
    render(<Form />)
    await user.type(screen.getByLabelText('Vĩ độ khách sạn'), '0')
    expect(screen.getByRole('alert')).toHaveTextContent('Nhập đủ vĩ độ')
    await user.type(screen.getByLabelText('Kinh độ khách sạn'), '0')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Vĩ độ khách sạn')).toHaveValue(0)
  })

  it('does not save an address suggestion until the owner confirms it', async () => {
    vi.mocked(searchHotelLocations).mockResolvedValue([{ id: 'result', address: '1 Beach Road', longitude: 108.24, latitude: 16.06 }])
    const user = userEvent.setup()
    render(<Form />)
    await user.click(screen.getByRole('button', { name: 'Tìm địa chỉ trên bản đồ' }))
    await screen.findByText('Chọn địa chỉ phù hợp với khách sạn')
    expect(screen.getByLabelText('Vĩ độ khách sạn')).toHaveValue(null)
    await user.click(screen.getByRole('button', { name: 'Chọn vị trí: 1 Beach Road' }))
    expect(screen.getByLabelText('Vĩ độ khách sạn')).toHaveValue(16.06)
    expect(screen.getByLabelText('Kinh độ khách sạn')).toHaveValue(108.24)
  })

  it('searches a separate address with Enter without submitting the hotel form or auto-searching', async () => {
    vi.mocked(searchHotelLocations).mockResolvedValue([
      { id: 'first', address: 'Đà Nẵng', latitude: 16.06, longitude: 108.24 },
      { id: 'second', address: 'Sơn Trà, Đà Nẵng', latitude: 16.1, longitude: 108.25 },
    ])
    const user = userEvent.setup()
    const submit = vi.fn(event => event.preventDefault())
    render(<form onSubmit={submit}><Form address="" /></form>)
    const input = screen.getByRole('searchbox', { name: 'Địa chỉ cần tìm trên bản đồ' })
    await user.type(input, 'Đà Nẵng')
    expect(searchHotelLocations).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Tìm địa chỉ trên bản đồ' })).toBeEnabled()
    await user.type(input, '{Enter}')
    await screen.findByText('Sơn Trà, Đà Nẵng')
    expect(submit).not.toHaveBeenCalled()
    expect(searchHotelLocations).toHaveBeenCalledWith('Đà Nẵng', expect.any(AbortSignal))
    expect(screen.getByLabelText('Vĩ độ khách sạn')).toHaveValue(null)
    await user.click(screen.getByRole('button', { name: 'Chọn vị trí: Sơn Trà, Đà Nẵng' }))
    expect(screen.getByLabelText('Vĩ độ khách sạn')).toHaveValue(16.1)
    expect(screen.getByLabelText('Kinh độ khách sạn')).toHaveValue(108.25)
  })

  it('validates an empty query and reports empty results and rate limiting', async () => {
    const user = userEvent.setup()
    render(<Form address="" />)
    const input = screen.getByRole('searchbox')
    const button = screen.getByRole('button', { name: 'Tìm địa chỉ trên bản đồ' })
    await user.click(button)
    expect(screen.getByRole('alert')).toHaveTextContent('3 đến 200')
    expect(searchHotelLocations).not.toHaveBeenCalled()
    vi.mocked(searchHotelLocations).mockResolvedValueOnce([])
    await user.type(input, 'Unknown address')
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy địa chỉ')
    vi.mocked(searchHotelLocations).mockRejectedValueOnce({ status: 429 })
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('đang bận')
    expect(screen.getByLabelText('Vĩ độ khách sạn')).toHaveValue(null)
  })

  it('ignores stale results after editing a query or manually choosing coordinates', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof searchHotelLocations>>) => void
    vi.mocked(searchHotelLocations).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const user = userEvent.setup()
    render(<Form />)
    await user.click(screen.getByRole('button', { name: 'Tìm địa chỉ trên bản đồ' }))
    expect(screen.getByRole('button', { name: 'Tìm địa chỉ trên bản đồ' })).toBeDisabled()
    await user.type(screen.getByRole('searchbox'), ' new')
    await act(async () => resolve([{ id: 'stale', address: 'Stale result', latitude: 1, longitude: 2 }]))
    expect(screen.queryByText('Stale result')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tìm địa chỉ trên bản đồ' })).toBeEnabled()
    expect(screen.getByLabelText('Vĩ độ khách sạn')).toHaveValue(null)
  })

  it('searches successfully without a Mapbox token', async () => {
    vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', '')
    vi.mocked(searchHotelLocations).mockResolvedValueOnce([{ id: 'result', address: 'Đà Nẵng', latitude: 16.06, longitude: 108.24 }])
    const user = userEvent.setup()
    render(<Form address="Đà Nẵng" />)
    await user.click(screen.getByRole('button', { name: 'Tìm địa chỉ trên bản đồ' }))
    await user.click(await screen.findByRole('button', { name: 'Chọn vị trí: Đà Nẵng' }))
    expect(screen.getByLabelText('Kinh độ khách sạn')).toHaveValue(108.24)
  })

  it('keeps location editing locked while the hotel awaits approval', () => {
    render(<Form disabled />)
    expect(screen.getByLabelText('Vĩ độ khách sạn')).toBeDisabled()
    expect(screen.getByLabelText('Kinh độ khách sạn')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Dùng vị trí hiện tại' })).toBeDisabled()
    expect(mocks.mapEvents.click).toBeUndefined()
  })

  it('still permits manual coordinates when the map is not configured', async () => {
    vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', '')
    const user = userEvent.setup()
    render(<Form />)
    await user.type(screen.getByLabelText('Vĩ độ khách sạn'), '16.06')
    await user.type(screen.getByLabelText('Kinh độ khách sạn'), '108.24')
    expect(screen.getByLabelText('Kinh độ khách sạn')).toHaveValue(108.24)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
