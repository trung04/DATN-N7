import { UsersService } from '../../users/services/users.service';
import { HotelOwnerEntity } from '../../users/entities/hotel-owner.entity';
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
      bankBin: null,
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

  it('saves the canonical bank for a selected BIN and preserves leading zeroes', async () => {
    repository.findByUserId.mockResolvedValue(hotelOwner());
    saveHotelOwner.mockImplementation(async value => value);

    await expect(service.update(userId, {
      bankBin: '970407',
      bankName: 'Untrusted bank name',
      bankAccountNumber: '0123456789',
      bankAccountHolder: ' NGUYEN VAN A ',
    })).resolves.toMatchObject({
      bankBin: '970407', bankName: 'Techcombank', bankAccountNumber: '0123456789', bankAccountHolder: 'NGUYEN VAN A',
    });
  });

  it('rejects unsupported selections and demo account details', async () => {
    repository.findByUserId.mockResolvedValue(hotelOwner());
    await expect(service.update(userId, { bankBin: '111111' })).rejects.toThrow('có trong danh sách');
    await expect(service.update(userId, {
      bankBin: '970407', bankAccountNumber: 'DEMO-NO-REAL', bankAccountHolder: 'DEMO ONLY - HOST 00000000',
    })).rejects.toThrow('4 đến 24 chữ số');
    expect(saveHotelOwner).not.toHaveBeenCalled();
  });

  it('clears the stored BIN when a legacy caller switches the bank name', async () => {
    repository.findByUserId.mockResolvedValue(hotelOwner({ bankName: 'Techcombank', bankBin: '970407' }));
    saveHotelOwner.mockImplementation(async value => value);
    await expect(service.update(userId, { bankName: 'Vietcombank' })).resolves.toMatchObject({ bankBin: null, bankName: 'Vietcombank' });
  });

  it('rejects reading a user without an owner profile', async () => {
    repository.findByUserId.mockResolvedValue(null);

    await expect(service.findByUserId(userId)).rejects.toBeInstanceOf(
      HotelOwnerNotFoundException,
    );
  });
});
