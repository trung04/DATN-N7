import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateHotelRequest } from './update-hotel.request';

describe('Hotel coordinate request validation', () => {
  it.each([{ latitude: 0, longitude: 0 }, { latitude: -90, longitude: 180 }, { latitude: null, longitude: null }])('accepts valid coordinates: %j', async (input) => {
    expect(await validate(plainToInstance(UpdateHotelRequest, input))).toHaveLength(0);
  });
  it.each([{ latitude: 91 }, { longitude: 181 }, { latitude: '' }, { longitude: '108.24' }, { latitude: NaN }, { longitude: Infinity }])('rejects invalid values rather than coercing them to zero: %j', async (input) => {
    expect((await validate(plainToInstance(UpdateHotelRequest, input))).length).toBeGreaterThan(0);
  });
});
