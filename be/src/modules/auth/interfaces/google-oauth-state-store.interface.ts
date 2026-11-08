export const GOOGLE_OAUTH_STATE_STORE = Symbol('GOOGLE_OAUTH_STATE_STORE');

export interface GoogleOAuthState {
  codeVerifier: string;
  nonce: string;
  returnTo: string;
}

export interface GoogleOAuthStateStore {
  save(state: string, context: GoogleOAuthState, ttlMs: number): Promise<void>;
  consume(state: string): Promise<GoogleOAuthState | null>;
}
