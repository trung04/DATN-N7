import { Inject, Injectable } from '@nestjs/common';
import { CreateUserRequest } from '../dtos/requests/create-user.request';
import { ListUsersRequest } from '../dtos/requests/list-users.request';
import { ResetUserPasswordRequest } from '../dtos/requests/reset-user-password.request';
import { UpdateUserRequest } from '../dtos/requests/update-user.request';
import { UserEntity } from '../entities/user.entity';
import {
  EmptyUserUpdateException,
  GoogleAccountConflictException,
  InvalidDateOfBirthException,
  UserEmailConflictException,
  UserNotFoundException,
  UsernameConflictException,
} from '../exceptions/user.exceptions';
import { PASSWORD_HASHER } from '../interfaces/password-hasher.interface';
import type { PasswordHasher } from '../interfaces/password-hasher.interface';
import { USER_REPOSITORY } from '../interfaces/user.repository.interface';
import type {
  UserPage,
  UserRepository,
} from '../interfaces/user.repository.interface';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async create(input: CreateUserRequest): Promise<UserEntity> {
    const username = this.normalizeUsername(input.username);
    const email = this.normalizeEmail(input.email);
    const googleAccountId = this.normalizeNullable(input.googleAccountId);
    await this.assertIdentityAvailable(username, email, googleAccountId);
    this.assertDateOfBirth(input.dateOfBirth);

    const passwordHash = await this.passwordHasher.hash(input.password);
    return this.repository.create({
      username,
      email,
      passwordHash,
      googleAccountId,
      firstName: this.normalizeNullable(input.firstName),
      lastName: this.normalizeNullable(input.lastName),
      displayName: this.normalizeNullable(input.displayName),
      phoneNumber: this.normalizeNullable(input.phoneNumber),
      dateOfBirth: input.dateOfBirth ?? null,
      gender: input.gender ?? null,
      status: input.status,
      isEmailVerified: false,
    });
  }

  findPage(input: ListUsersRequest): Promise<UserPage> {
    return this.repository.findPage({
      page: input.page,
      limit: input.limit,
      search: input.search,
      status: input.status,
      gender: input.gender,
      isEmailVerified: input.isEmailVerified,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.repository.findById(id);
    if (!user) throw new UserNotFoundException(id);
    return user;
  }

  async update(id: string, input: UpdateUserRequest): Promise<UserEntity> {
    if (this.isEmptyUpdate(input)) throw new EmptyUserUpdateException();
    const user = await this.findById(id);

    if (input.username !== undefined) {
      const username = this.normalizeUsername(input.username);
      const duplicate = await this.repository.findByUsername(username);
      if (duplicate && duplicate.id !== user.id) {
        throw new UsernameConflictException(username);
      }
      user.username = username;
    }

    if (input.email !== undefined) {
      const email = this.normalizeEmail(input.email);
      const duplicate = await this.repository.findByEmail(email);
      if (duplicate && duplicate.id !== user.id) {
        throw new UserEmailConflictException(email);
      }
      if (email !== user.email) user.isEmailVerified = false;
      user.email = email;
    }

    if (input.googleAccountId !== undefined) {
      const googleAccountId = this.normalizeNullable(input.googleAccountId);
      if (googleAccountId) {
        const duplicate =
          await this.repository.findByGoogleAccountId(googleAccountId);
        if (duplicate && duplicate.id !== user.id) {
          throw new GoogleAccountConflictException();
        }
      }
      user.googleAccountId = googleAccountId;
    }

    if (input.dateOfBirth !== undefined) {
      this.assertDateOfBirth(input.dateOfBirth ?? undefined);
      user.dateOfBirth = input.dateOfBirth;
    }
    if (input.firstName !== undefined)
      user.firstName = this.normalizeNullable(input.firstName);
    if (input.lastName !== undefined)
      user.lastName = this.normalizeNullable(input.lastName);
    if (input.displayName !== undefined)
      user.displayName = this.normalizeNullable(input.displayName);
    if (input.phoneNumber !== undefined)
      user.phoneNumber = this.normalizeNullable(input.phoneNumber);
    if (input.gender !== undefined) user.gender = input.gender;
    if (input.status !== undefined) user.status = input.status;

    return this.repository.save(user);
  }

  async resetPassword(
    id: string,
    input: ResetUserPasswordRequest,
  ): Promise<void> {
    const user = await this.findById(id);
    user.passwordHash = await this.passwordHasher.hash(input.newPassword);
    await this.repository.save(user);
  }

  async delete(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.repository.delete(user);
  }

  private async assertIdentityAvailable(
    username: string,
    email: string,
    googleAccountId: string | null,
  ): Promise<void> {
    if (await this.repository.findByUsername(username)) {
      throw new UsernameConflictException(username);
    }
    if (await this.repository.findByEmail(email)) {
      throw new UserEmailConflictException(email);
    }
    if (
      googleAccountId &&
      (await this.repository.findByGoogleAccountId(googleAccountId))
    ) {
      throw new GoogleAccountConflictException();
    }
  }

  private assertDateOfBirth(value?: string): void {
    if (value && value > new Date().toISOString().slice(0, 10)) {
      throw new InvalidDateOfBirthException();
    }
  }

  private isEmptyUpdate(input: UpdateUserRequest): boolean {
    return [
      input.username,
      input.email,
      input.googleAccountId,
      input.firstName,
      input.lastName,
      input.displayName,
      input.phoneNumber,
      input.dateOfBirth,
      input.gender,
      input.status,
    ].every((value) => value === undefined);
  }

  private normalizeUsername(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }
}
