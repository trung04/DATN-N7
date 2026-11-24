import { RoomsService } from './rooms.service';
import type { RoomRepository } from '../interfaces/room.repository.interface';
import type { AmenitiesService } from '../../amenities/services/amenities.service';
import type { HotelsService } from '../../hotels/services/hotels.service';
import { ListRoomsRequest } from '../dtos/requests/list-rooms.request';
import { UserRole } from '../../users/entities/user.entity';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';

describe('Managed room pages', () => {
  const findPage = jest.fn().mockResolvedValue({ items: [], total: 150 });
  const hotels = { findOwnedIds: jest.fn().mockResolvedValue(['owned-a', 'owned-b']), assertManagedBy: jest.fn() };
  const amenities = { findExistingByIds: jest.fn().mockResolvedValue([]) };
  const service = new RoomsService(
    { findPage } as unknown as RoomRepository,
    amenities as unknown as AmenitiesService,
    hotels as unknown as HotelsService,
  );
  const owner = { id: 'owner', role: UserRole.HOTEL_OWNER };
  beforeEach(() => jest.clearAllMocks());

  it('scopes every page and its total to the authenticated owner', async () => {
    const query = Object.assign(new ListRoomsRequest(), { page: 2, limit: 20 });
    expect((await service.findManagedPage(query, owner)).total).toBe(150);
    expect(hotels.findOwnedIds).toHaveBeenCalledWith('owner');
    expect(findPage).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 20, hotelIds: ['owned-a', 'owned-b'] }));
  });
  it('rejects a selected hotel belonging to another owner before reading rooms', async () => {
    hotels.assertManagedBy.mockRejectedValueOnce(new AuthorizationDeniedException());
    const query = Object.assign(new ListRoomsRequest(), { hotelId: 'foreign' });
    await expect(service.findManagedPage(query, owner)).rejects.toBeInstanceOf(AuthorizationDeniedException);
    expect(findPage).not.toHaveBeenCalled();
  });
  it('allows owners to list rooms in their inactive hotels for management', async () => {
    const query = Object.assign(new ListRoomsRequest(), { hotelId: 'owned-a' });
    await service.findManagedPage(query, owner);
    expect(hotels.assertManagedBy).toHaveBeenCalledWith('owned-a', owner);
    expect(findPage).toHaveBeenCalledWith(expect.objectContaining({ hotelId: 'owned-a' }));
  });
  it('keeps an owner without hotels scoped to an empty collection', async () => {
    hotels.findOwnedIds.mockResolvedValueOnce([]);
    await service.findManagedPage(new ListRoomsRequest(), owner);
    expect(findPage).toHaveBeenCalledWith(expect.objectContaining({ hotelIds: [] }));
  });
  it('rejects tourist access independently of the HTTP role guard', async () => {
    await expect(service.findManagedPage(new ListRoomsRequest(), { id: 'tourist', role: UserRole.TOURIST })).rejects.toBeInstanceOf(AuthorizationDeniedException);
    expect(findPage).not.toHaveBeenCalled();
  });
  it('preserves the public room listing contract', async () => {
    await service.findPage(new ListRoomsRequest());
    expect(hotels.findOwnedIds).not.toHaveBeenCalled();
    expect(findPage).toHaveBeenCalledWith(expect.objectContaining({ hotelIds: undefined }));
  });
});
