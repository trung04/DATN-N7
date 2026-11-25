import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListPlacesRequest } from './list-places.request';

describe('ListPlacesRequest discovery filters', () => {
  it('normalizes city and category filters', async () => {
    const request = plainToInstance(ListPlacesRequest, {
      city: ' Đà Nẵng ',
      categoryCode: 'attraction',
    });

    await expect(validate(request)).resolves.toEqual([]);
    expect(request.city).toBe('Đà Nẵng');
    expect(request.categoryCode).toBe('ATTRACTION');
  });

  it('rejects an invalid category code', async () => {
    const request = plainToInstance(ListPlacesRequest, {
      categoryCode: 'restaurant!',
    });

    await expect(validate(request)).resolves.not.toEqual([]);
  });
});
