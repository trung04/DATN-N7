import { UserEntity, UserRole, UserStatus } from '../entities/user.entity';
import {
  EmptyUserUpdateException,
  InvalidDateOfBirthException,
  UsernameConflictException,
} from '../exceptions/user.exceptions';
import type { PasswordHasher } from '../interfaces/password-hasher.interface';
import type { UserRepository } from '../interfaces/user.repository.interface';
import { UsersService } from './users.service';

const user = (overrides: Partial<UserEntity> = {}): UserEntity =>
  Object.assign(new UserEntity(), {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'traveler',
    email: 'traveler@example.com',
    passwordHash: '$2b$12$hashed',
    googleAccountId: null,
    firstName: null,
    lastName: null,
    displayName: null,
    phoneNumber: null,
    dateOfBirth: null,
    gender: null,
    status: UserStatus.ACTIVE,
    role: UserRole.TOURIST,
    isEmailVerified: false,
    createdAt: new Date('2026-11-03T00:00:00.000Z'),
    updatedAt: new Date('2026-11-03T00:00:00.000Z'),
    ...overrides,
  });

describe('UsersService', () => {
  let repository: jest.Mocked<UserRepository>;
  let passwordHasher: jest.Mocked<PasswordHasher>;
  let service: UsersService;
  let createUser: jest.MockedFunction<UserRepository['create']>;
  let saveUser: jest.MockedFunction<UserRepository['save']>;
  let hashPassword: jest.MockedFunction<PasswordHasher['hash']>;

  beforeEach(() => {
    createUser = jest.fn();
    saveUser = jest.fn();
    hashPassword = jest.fn();
    repository = {
      findById: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      findByGoogleAccountId: jest.fn(),
      findPage: jest.fn(),
      create: createUser,
      save: saveUser,
      delete: jest.fn(),
    };
    passwordHasher = { hash: hashPassword };
    service = new UsersService(repository, passwordHasher);
  });

  it('normalizes identity and stores only the password hash', async () => {
    const saved = user();
    repository.findByUsername.mockResolvedValue(null);
    repository.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('$2b$12$hashed');
    createUser.mockResolvedValue(saved);

    await expect(
      service.create({
        username: ' Traveler ',
        email: ' Traveler@Example.com ',
        password: 'Password123',
        status: UserStatus.ACTIVE,
      }),
    ).resolves.toBe(saved);
    expect(hashPassword).toHaveBeenCalledWith('Password123');
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'traveler',
        email: 'traveler@example.com',
        passwordHash: '$2b$12$hashed',
        isEmailVerified: false,
        role: UserRole.TOURIST,
      }),
    );
    expect(createUser.mock.calls[0][0]).not.toHaveProperty('password');
  });

  it('rejects a duplicate username', async () => {
    repository.findByUsername.mockResolvedValue(user());

    await expect(
      service.create({
        username: 'traveler',
        email: 'new@example.com',
        password: 'Password123',
        status: UserStatus.ACTIVE,
      }),
    ).rejects.toBeInstanceOf(UsernameConflictException);
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it('rejects a future date of birth', async () => {
    repository.findByUsername.mockResolvedValue(null);
    repository.findByEmail.mockResolvedValue(null);

    await expect(
      service.create({
        username: 'future-user',
        email: 'future@example.com',
        password: 'Password123',
        dateOfBirth: '2999-01-01',
        status: UserStatus.ACTIVE,
      }),
    ).rejects.toBeInstanceOf(InvalidDateOfBirthException);
  });

  it('clears email verification when email changes', async () => {
    const existing = user({ isEmailVerified: true });
    repository.findById.mockResolvedValue(existing);
    repository.findByEmail.mockResolvedValue(null);
    saveUser.mockImplementation(async (value) => value);

    const updated = await service.update(existing.id, {
      email: 'new@example.com',
    });

    expect(updated.email).toBe('new@example.com');
    expect(updated.isEmailVerified).toBe(false);
  });

  it('rejects an empty update', async () => {
    await expect(service.update(user().id, {})).rejects.toBeInstanceOf(
      EmptyUserUpdateException,
    );
  });

  it('hashes a replacement password before saving', async () => {
    const existing = user();
    repository.findById.mockResolvedValue(existing);
    passwordHasher.hash.mockResolvedValue('$2b$12$replacement');
    saveUser.mockImplementation(async (value) => value);

    await service.resetPassword(existing.id, { newPassword: 'NewPassword123' });

    expect(existing.passwordHash).toBe('$2b$12$replacement');
    expect(saveUser).toHaveBeenCalledWith(existing);
  });
});
