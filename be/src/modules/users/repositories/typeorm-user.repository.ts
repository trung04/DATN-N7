import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import {
  GoogleAccountConflictException,
  UserEmailConflictException,
  UsernameConflictException,
} from '../exceptions/user.exceptions';
import type {
  CreateUserData,
  FindUsersOptions,
  UserPage,
  UserRepository,
} from '../interfaces/user.repository.interface';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  findById(id: string): Promise<UserEntity | null> {
    return this.repository.findOneBy({ id });
  }

  findByUsername(username: string): Promise<UserEntity | null> {
    return this.repository
      .createQueryBuilder('user')
      .where('LOWER(user.username) = LOWER(:username)', { username })
      .getOne();
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  findByGoogleAccountId(googleAccountId: string): Promise<UserEntity | null> {
    return this.repository.findOneBy({ googleAccountId });
  }

  async findPage(options: FindUsersOptions): Promise<UserPage> {
    const query = this.repository.createQueryBuilder('user');

    if (options.search) {
      const escapedSearch = options.search.replace(/[\\%_]/g, '\\$&');
      query.andWhere(
        `(user.username ILIKE :search ESCAPE '\\'
          OR user.email ILIKE :search ESCAPE '\\'
          OR user.displayName ILIKE :search ESCAPE '\\')`,
        { search: `%${escapedSearch}%` },
      );
    }
    if (options.status) {
      query.andWhere('user.status = :status', { status: options.status });
    }
    if (options.gender) {
      query.andWhere('user.gender = :gender', { gender: options.gender });
    }
    if (options.isEmailVerified !== undefined) {
      query.andWhere('user.isEmailVerified = :isEmailVerified', {
        isEmailVerified: options.isEmailVerified,
      });
    }

    const sortColumns: Record<FindUsersOptions['sortBy'], string> = {
      username: 'user.username',
      email: 'user.email',
      displayName: 'user.displayName',
      createdAt: 'user.createdAt',
      updatedAt: 'user.updatedAt',
    };

    const [items, total] = await query
      .orderBy(sortColumns[options.sortBy], options.sortOrder)
      .addOrderBy('user.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    return { items, total };
  }

  async create(data: CreateUserData): Promise<UserEntity> {
    try {
      return await this.repository.save(this.repository.create(data));
    } catch (error) {
      this.rethrowIdentityConflict(error, data);
    }
  }

  async save(user: UserEntity): Promise<UserEntity> {
    try {
      return await this.repository.save(user);
    } catch (error) {
      this.rethrowIdentityConflict(error, user);
    }
  }

  async delete(user: UserEntity): Promise<void> {
    await this.repository.remove(user);
  }

  private rethrowIdentityConflict(
    error: unknown,
    user: Pick<UserEntity, 'username' | 'email' | 'googleAccountId'>,
  ): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      const constraint = (error.driverError as { constraint?: string })
        .constraint;
      if (constraint === 'UQ_users_username_lower') {
        throw new UsernameConflictException(user.username);
      }
      if (constraint === 'UQ_users_email_lower') {
        throw new UserEmailConflictException(user.email);
      }
      if (constraint === 'UQ_users_google_account_id') {
        throw new GoogleAccountConflictException();
      }
    }
    throw error;
  }
}
