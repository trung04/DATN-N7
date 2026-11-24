export const AUTH_CHALLENGE_STORE = Symbol('AUTH_CHALLENGE_STORE');

export type AuthChallengePurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

export type ChallengeConsumeResult = 'valid' | 'invalid' | 'expired' | 'locked';

export interface AuthChallengeStore {
  issue(
    email: string,
    purpose: AuthChallengePurpose,
    codeHash: string,
    ttlMs: number,
    cooldownMs: number,
  ): Promise<boolean>;
  consume(
    email: string,
    purpose: AuthChallengePurpose,
    codeHash: string,
  ): Promise<ChallengeConsumeResult>;
  clear(email: string, purpose: AuthChallengePurpose): Promise<void>;
}
