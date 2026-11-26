export const TWO_FACTOR_LOGIN_CHALLENGE_STORE = Symbol(
  'TWO_FACTOR_LOGIN_CHALLENGE_STORE',
);

export interface TwoFactorLoginChallenge {
  userId: string;
  returnTo: string;
}

export interface TwoFactorLoginChallengeStore {
  create(userId: string, returnTo: string, ttlMs: number): Promise<string>;
  takeAttempt(token: string): Promise<TwoFactorLoginChallenge | null>;
}
