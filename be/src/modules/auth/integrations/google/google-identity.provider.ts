import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CodeChallengeMethod,
  OAuth2Client,
  type TokenPayload,
} from 'google-auth-library';
import {
  GoogleAuthenticationFailedException,
  GoogleAuthenticationUnavailableException,
} from '../../exceptions/auth.exceptions';
import type {
  GoogleAuthorizationRequest,
  GoogleIdentity,
  GoogleIdentityProvider,
} from '../../interfaces/google-identity-provider.interface';

@Injectable()
export class GoogleIdentityClient implements GoogleIdentityProvider {
  constructor(private readonly config: ConfigService) {}

  async createAuthorizationRequest(
    state: string,
    nonce: string,
  ): Promise<GoogleAuthorizationRequest> {
    const client = this.client();
    const { codeVerifier, codeChallenge } =
      await client.generateCodeVerifierAsync();
    return {
      codeVerifier,
      url: client.generateAuthUrl({
        access_type: 'online',
        scope: ['openid', 'email', 'profile'],
        prompt: 'select_account',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
      }),
    };
  }

  async exchangeCode(
    code: string,
    codeVerifier: string,
    nonce: string,
  ): Promise<GoogleIdentity> {
    const client = this.client();
    try {
      const { tokens } = await client.getToken({ code, codeVerifier });
      if (!tokens.id_token) throw new Error('Missing ID token');
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      });
      return this.toIdentity(ticket.getPayload(), nonce);
    } catch {
      throw new GoogleAuthenticationFailedException();
    }
  }

  private toIdentity(
    payload: TokenPayload | undefined,
    nonce: string,
  ): GoogleIdentity {
    if (
      !payload?.sub ||
      payload.sub.length > 255 ||
      !payload.email ||
      payload.email.length > 254 ||
      payload.email_verified !== true ||
      payload.nonce !== nonce
    ) {
      throw new Error('Invalid Google identity');
    }
    return {
      subject: payload.sub,
      email: payload.email.trim().toLowerCase(),
      displayName: this.profileValue(payload.name, 150),
      firstName: this.profileValue(payload.given_name, 100),
      lastName: this.profileValue(payload.family_name, 100),
    };
  }

  private profileValue(value: string | undefined, max: number): string | null {
    const normalized = value?.trim();
    return normalized ? normalized.slice(0, max) : null;
  }

  private client(): OAuth2Client {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = this.config
      .get<string>('GOOGLE_CLIENT_SECRET')
      ?.trim();
    const redirectUri = this.config.get<string>('GOOGLE_REDIRECT_URI')?.trim();
    if (!clientId || !clientSecret || !redirectUri) {
      throw new GoogleAuthenticationUnavailableException();
    }
    return new OAuth2Client({ clientId, clientSecret, redirectUri });
  }
}
