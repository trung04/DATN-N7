export const GOOGLE_IDENTITY_PROVIDER = Symbol('GOOGLE_IDENTITY_PROVIDER');

export interface GoogleIdentity {
  subject: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface GoogleAuthorizationRequest {
  url: string;
  codeVerifier: string;
}

export interface GoogleIdentityProvider {
  createAuthorizationRequest(
    state: string,
    nonce: string,
  ): Promise<GoogleAuthorizationRequest>;
  exchangeCode(
    code: string,
    codeVerifier: string,
    nonce: string,
  ): Promise<GoogleIdentity>;
}
