import axios, { type AxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { transport } = vi.hoisted(() => ({ transport: vi.fn() }))
vi.mock('axios', async importOriginal => {
  const actual = await importOriginal<typeof import('axios')>()
  return { ...actual, default: { ...actual.default, create: (config: AxiosRequestConfig) => actual.default.create({ ...config, adapter: transport }) } }
})
import { api, apiAssetUrl } from './client'

describe('hotel image API transport', () => {
  beforeEach(() => {
    transport.mockReset()
    transport.mockResolvedValue({ data: { id: 'image-id' }, status: 201, statusText: 'Created', headers: {}, config: {} })
  })
  it('sends the original file as multipart to the backend with session credentials', async () => {
    const file = new File(['image-bytes'], 'hotel.png', { type: 'image/png' })
    await expect(api.uploadHotelImage('hotel-id', file)).resolves.toEqual({ id: 'image-id' })
    const config = transport.mock.calls[0]![0]
    expect(config.url).toBe('/hotels/hotel-id/images')
    expect(config.withCredentials).toBe(true)
    expect(config.data).toBeInstanceOf(FormData)
    expect(config.data.get('file')).toBe(file)
    expect(config.headers.get('Content-Type')).not.toBe('application/json')
  })
  it('deletes through the backend and resolves file URLs on the API origin', async () => {
    await api.deleteHotelImage('hotel-id', 'image-id')
    expect(transport.mock.calls[0]![0]).toMatchObject({ method: 'delete', url: '/hotels/hotel-id/images/image-id', withCredentials: true })
    expect(apiAssetUrl('/api/v1/hotels/hotel-id/images/image-id/file')).toBe(new URL('/api/v1/hotels/hotel-id/images/image-id/file', window.location.origin).href)
  })
  it('surfaces backend storage errors for the upload form', async () => {
    transport.mockRejectedValueOnce(new axios.AxiosError('Unavailable', 'ERR_BAD_RESPONSE', undefined, undefined, {
      data: { code: 'HOTEL_IMAGE_STORAGE_UNAVAILABLE', detail: 'Image storage unavailable' }, status: 503, statusText: 'Unavailable', headers: {}, config: {} as never,
    }))
    await expect(api.uploadHotelImage('hotel-id', new File(['x'], 'hotel.png', { type: 'image/png' }))).rejects.toMatchObject({ message: 'Image storage unavailable' })
  })
})
