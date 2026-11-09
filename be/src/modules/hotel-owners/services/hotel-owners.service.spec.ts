import { UsersService } from '../../users/services/users.service';
import { HotelOwnerEntity } from '../entities/hotel-owner.entity';
import {
  EmptyHotelOwnerUpdateException,
  HotelOwnerConflictException,
  HotelOwnerNotFoundException,
} from '../exceptions/hotel-owner.exceptions';
import type { HotelOwnerRepository } from '../interfaces/hotel-owner.repository.interface';
import { HotelOwnersService } from './hotel-owners.service';

const userId = '11111111-1111-4111-8111-111111111111';

const hotelOwner = (
  overrides: Partial<HotelOwnerEntity> = {},
): HotelOwnerEntity =>
  Object.assign(new HotelOwnerEntity(), {
    userId,
    bankName: 'Example Bank',
    bankAccountNumber: '123456789',
    bankAccountHolder: 'NGUYEN VAN A',
    ...overrides,
  });

describe('HotelOwnersService', () => {
  let repository: jest.Mocked<HotelOwnerRepository>;
  let usersService: jest.Mocked<Pick<UsersService, 'findById' | 'assignRole'>>;
  let service: HotelOwnersService;
  let createHotelOwner: jest.MockedFunction<HotelOwnerRepository['create']>;
  let saveHotelOwner: jest.MockedFunction<HotelOwnerRepository['save']>;

  beforeEach(() => {
    createHotelOwner = jest.fn();
    saveHotelOwner = jest.fn();
    repository = {
      findByUserId: jest.fn(),
      findPage: jest.fn(),
      create: createHotelOwner,
      save: saveHotelOwner,
      delete: jest.fn(),
    };
    usersService = { findById: jest.fn(), assignRole: jest.fn() };
    service = new HotelOwnersService(
      repository,
      usersService as unknown as UsersService,
    );
  });

  it('validates the user and normalizes bank data when creating', async () => {
    const saved = hotelOwner();
    usersService.findById.mockResolvedValue({} as never);
    repository.findByUserId.mockResolvedValue(null);
    repository.create.mockResolvedValue(saved);

    await expect(
      service.create({
        userId,
        bankName: ' Example Bank ',
        bankAccountNumber: ' 123456789 ',
        bankAccountHolder: ' NGUYEN VAN A ',
      }),
    ).resolves.toBe(saved);

    expect(usersService.findById).toHaveBeenCalledWith(userId);
    expect(createHotelOwner).toHaveBeenCalledWith({
      userId,
      bankName: 'Example Bank',
      bankAccountNumber: '123456789',
      bankAccountHolder: 'NGUYEN VAN A',
    });
    expect(usersService.assignRole).toHaveBeenCalledWith(userId, 'HOTEL_OWNER');
  });

  it('rejects a second owner profile for the same user', async () => {
    usersService.findById.mockResolvedValue({} as never);
    repository.findByUserId.mockResolvedValue(hotelOwner());

    await expect(service.create({ userId })).rejects.toBeInstanceOf(
      HotelOwnerConflictException,
    );
    expect(createHotelOwner).not.toHaveBeenCalled();
  });

  it('rejects an empty update', async () => {
    await expect(service.update(userId, {})).rejects.toBeInstanceOf(
      EmptyHotelOwnerUpdateException,
    );
  });

  it('allows nullable bank fields to be cleared', async () => {
    const existing = hotelOwner();
    repository.findByUserId.mockResolvedValue(existing);
    repository.save.mockImplementation(async (value) => value);

    const updated = await service.update(userId, {
      bankAccountNumber: null,
    });

    expect(updated.bankAccountNumber).toBeNull();
    expect(saveHotelOwner).toHaveBeenCalledWith(existing);
  });

  it('rejects reading a user without an owner profile', async () => {
    repository.findByUserId.mockResolvedValue(null);

    await expect(service.findByUserId(userId)).rejects.toBeInstanceOf(
      HotelOwnerNotFoundException,
    );
  });
});
