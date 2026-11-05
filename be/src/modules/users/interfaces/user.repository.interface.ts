import {
  UserEntity,
  UserGender,
  UserRole,
  UserStatus,
} from '../entities/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export type UserSortField =
  'username' | 'email' | 'displayName' | 'createdAt' | 'updatedAt';

export interface FindUsersOptions {
  page: number;
  limit: number;
  search?: string;
  status?: UserStatus;
  role?: UserRole;
  gender?: UserGender;
  isEmailVerified?: boolean;
  sortBy: UserSortField;
  sortOrder: 'ASC' | 'DESC';
}

export interface UserPage {
  items: UserEntity[];
  total: number;
}

export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
  googleAccountId: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  gender: UserGender | null;
  status: UserStatus;
  role: UserRole;
  isEmailVerified: boolean;
}

export interface UserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByUsername(username: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByGoogleAccountId(googleAccountId: string): Promise<UserEntity | null>;
  findPage(options: FindUsersOptions): Promise<UserPage>;
  create(data: CreateUserData): Promise<UserEntity>;
  save(user: UserEntity): Promise<UserEntity>;
  delete(user: UserEntity): Promise<void>;
}
