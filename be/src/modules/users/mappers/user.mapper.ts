import {
  UserListResponse,
  UserResponse,
} from '../dtos/responses/user.response';
import { UserEntity } from '../entities/user.entity';

export class UserMapper {
  static toResponse(user: UserEntity): UserResponse {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      googleAccountLinked: user.googleAccountId !== null,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      status: user.status,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  static toListResponse(
    users: UserEntity[],
    page: number,
    limit: number,
    total: number,
  ): UserListResponse {
    return {
      data: users.map((user) => this.toResponse(user)),
      meta: { page, limit, total },
    };
  }
}
