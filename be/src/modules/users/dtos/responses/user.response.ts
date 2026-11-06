import { UserGender, UserStatus } from '../../entities/user.entity';

export class UserResponse {
  id: string;
  username: string;
  email: string;
  googleAccountLinked: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  gender: UserGender | null;
  status: UserStatus;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export class UserListResponse {
  data: UserResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
