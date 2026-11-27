import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MapPlacesRequest } from './map-places.request';

describe('MapPlacesRequest', () => {
  it('parses a viewport and normalizes multiple category codes', async () => {
    const request = plainToInstance(MapPlacesRequest, {
      bbox: '108.12,15.95,108.30,16.15',
      zoom: '12',
      categoryCodes: 'restaurant,ATTRACTION,restaurant',
    });

    await expect(validate(request)).resolves.toEqual([]);
    expect(request.bbox).toEqual([108.12, 15.95, 108.3, 16.15]);
    expect(request.zoom).toBe(12);
    expect(request.categoryCodes).toEqual(['RESTAURANT', 'ATTRACTION']);
  });

  it.each([
    ['missing coordinate', '108.12,15.95,108.30'],
    ['latitude outside range', '108.12,-91,108.30,16.15'],
    ['west not before east', '108.30,15.95,108.12,16.15'],
    ['south not before north', '108.12,16.15,108.30,15.95'],
  ])('rejects an invalid bbox: %s', async (_label, bbox) => {
    const request = plainToInstance(MapPlacesRequest, { bbox, zoom: '12' });

    await expect(validate(request)).resolves.not.toEqual([]);
  });

  it('rejects unsupported zoom levels and category codes', async () => {
    const request = plainToInstance(MapPlacesRequest, {
      bbox: '108.12,15.95,108.30,16.15',
      zoom: '23',
      categoryCodes: 'restaurant!',
    });

    await expect(validate(request)).resolves.not.toEqual([]);
  });
});
