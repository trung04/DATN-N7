import { UserRole } from '../../users/entities/user.entity';

export interface AuthorizationActor {
  id: string;
  role: UserRole;
}
