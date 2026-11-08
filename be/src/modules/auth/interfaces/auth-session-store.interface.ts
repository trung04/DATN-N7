export const AUTH_SESSION_STORE = Symbol('AUTH_SESSION_STORE');

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresInMs: number;
  refreshExpiresInMs: number;
}

export interface AccessSession {
  userId: string;
  familyId: string;
}

export type RefreshSessionResult =
  | ({ status: 'rotated'; userId: string; familyId: string } & SessionTokens)
  | { status: 'invalid' | 'reused' };

export interface AuthSessionStore {
  create(userId: string): Promise<SessionTokens>;
  validateAccess(accessToken: string): Promise<AccessSession | null>;
  rotate(refreshToken: string): Promise<RefreshSessionResult>;
  revokeByTokens(accessToken?: string, refreshToken?: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
}
