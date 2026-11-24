import { ConfigService } from '@nestjs/config';
import { NominatimHotelGeocoder } from './nominatim-hotel-geocoder';
import { HotelLocationRateLimitedException, HotelLocationUnavailableException } from '../exceptions/hotel-location.exceptions';

describe('Hotel address geocoder', () => {
  let geocoder: NominatimHotelGeocoder;
  let client: { connect: jest.Mock; get: jest.Mock; set: jest.Mock; isOpen: boolean };
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  const result = { place_id: 1, osm_type: 'node', osm_id: 12, display_name: 'Đà Nẵng, Việt Nam', lat: '16.06', lon: '108.24' };
  beforeEach(() => {
    geocoder = new NominatimHotelGeocoder(new ConfigService());
    client = { connect: jest.fn().mockResolvedValue(undefined), get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK'), isOpen: false };
    Object.defineProperty(geocoder, 'client', { value: client });
    fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify([result])));
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => { global.fetch = originalFetch; });

  it('identifies the application, restricts Vietnam and caches explicit search results', async () => {
    const results = await geocoder.search('Đà Nẵng');
    expect(results).toEqual([{ id: 'node:12', address: result.display_name, latitude: 16.06, longitude: 108.24 }]);
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.origin).toBe('https://nominatim.openstreetmap.org');
    expect(url.searchParams.get('countrycodes')).toBe('vn');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(fetchMock.mock.calls[0][1].headers['User-Agent']).toContain('travellad.id.vn');
    expect(client.set).toHaveBeenCalledWith('tourism:hotel-location:provider-rate', '1', { NX: true, PX: 1100 });
    expect(client.set).toHaveBeenLastCalledWith(expect.stringMatching(/^tourism:hotel-location:v1:/), JSON.stringify(results), { EX: 86400 });
  });
  it('returns cached results without consuming a provider slot', async () => {
    client.get.mockResolvedValue('[]');
    await expect(geocoder.search('Đà Nẵng')).resolves.toEqual([]);
    expect(client.set).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects concurrent requests when the shared Redis reservation is taken', async () => {
    client.set.mockResolvedValue(null);
    await expect(geocoder.search('Đà Nẵng')).rejects.toBeInstanceOf(HotelLocationRateLimitedException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('backs off for a minute after upstream rate limiting without retrying', async () => {
    fetchMock.mockResolvedValue(new Response('private upstream body', { status: 429 }));
    await expect(geocoder.search('Đà Nẵng')).rejects.toBeInstanceOf(HotelLocationRateLimitedException);
    expect(client.set).toHaveBeenLastCalledWith('tourism:hotel-location:provider-rate', '1', { PX: 60000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('fails closed when Redis is unavailable', async () => {
    client.connect.mockRejectedValue(new Error('private cache credentials'));
    await expect(geocoder.search('Đà Nẵng')).rejects.toBeInstanceOf(HotelLocationUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('filters invalid coordinates and caches empty results', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ ...result, lat: 'NaN' }, { ...result, lon: '181' }, { ...result, lat: '' }, { ...result, display_name: '' }])));
    await expect(geocoder.search('Đà Nẵng')).resolves.toEqual([]);
    expect(client.set).toHaveBeenLastCalledWith(expect.any(String), '[]', { EX: 86400 });
  });
  it.each(['timeout', 'bad-json', 'upstream'])('masks %s failures without returning provider details', async mode => {
    if (mode === 'timeout') fetchMock.mockRejectedValue(new Error('timeout'));
    if (mode === 'bad-json') fetchMock.mockResolvedValue(new Response('bad json'));
    if (mode === 'upstream') fetchMock.mockResolvedValue(new Response('private upstream data', { status: 500 }));
    await expect(geocoder.search('Đà Nẵng')).rejects.toBeInstanceOf(HotelLocationUnavailableException);
  });
});
