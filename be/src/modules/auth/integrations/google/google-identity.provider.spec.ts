import { ConfigService } from '@nestjs/config';
import { GoogleAuthenticationUnavailableException } from '../../exceptions/auth.exceptions';
import { GoogleIdentityClient } from './google-identity.provider';

describe('GoogleIdentityClient', () => {
  const config = new ConfigService({
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/google/callback',
  });

  it('creates a minimal authorization request with PKCE', async () => {
    const provider = new GoogleIdentityClient(config);
    const client = {
      generateCodeVerifierAsync: jest.fn().mockResolvedValue({
        codeVerifier: 'verifier',
        codeChallenge: 'challenge',
      }),
      generateAuthUrl: jest.fn().mockReturnValue('https://google.example/auth'),
    };
    Object.defineProperty(provider, 'client', { value: () => client });

    await expect(
      provider.createAuthorizationRequest('state', 'nonce'),
    ).resolves.toEqual({
      url: 'https://google.example/auth',
      codeVerifier: 'verifier',
    });
    expect(client.generateAuthUrl.mock.calls[0][0]).toMatchObject({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state: 'state',
      nonce: 'nonce',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
    });
  });

  it('exchanges and validates an ID token without retaining Google tokens', async () => {
    const provider = new GoogleIdentityClient(config);
    const client = {
      getToken: jest.fn().mockResolvedValue({
        tokens: { id_token: 'verified-id-token', access_token: 'discard-me' },
      }),
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'google-subject',
          email: 'Traveler@Example.com',
          email_verified: true,
          nonce: 'nonce',
          name: 'Traveler',
          given_name: 'Travel',
          family_name: 'Er',
        }),
      }),
    };
    Object.defineProperty(provider, 'client', { value: () => client });

    await expect(
      provider.exchangeCode('code', 'verifier', 'nonce'),
    ).resolves.toEqual({
      subject: 'google-subject',
      email: 'traveler@example.com',
      displayName: 'Traveler',
      firstName: 'Travel',
      lastName: 'Er',
    });
    expect(client.getToken.mock.calls[0][0]).toEqual({
      code: 'code',
      codeVerifier: 'verifier',
    });
  });

  it('fails safely when Google login is not configured', async () => {
    const provider = new GoogleIdentityClient(new ConfigService({}));

    await expect(
      provider.createAuthorizationRequest('state', 'nonce'),
    ).rejects.toBeInstanceOf(GoogleAuthenticationUnavailableException);
  });
});
