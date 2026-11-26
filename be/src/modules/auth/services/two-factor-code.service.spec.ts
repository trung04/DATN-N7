import { ConfigService } from '@nestjs/config';
import { TwoFactorCodeService } from './two-factor-code.service';

describe('TwoFactorCodeService', () => {
  const encryptionKey = Buffer.alloc(32, 7).toString('base64');
  const service = new TwoFactorCodeService(
    new ConfigService({
      TWO_FACTOR_ENCRYPTION_KEY: encryptionKey,
      TWO_FACTOR_RECOVERY_PEPPER: 'r'.repeat(32),
    }),
  );

  it('validates RFC 6238 compatible six-digit TOTP codes with a small clock window', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    expect(service.verifyTotp(secret, '287082', 59_000)).toBe(true);
    expect(service.verifyTotp(secret, '287082', 89_000)).toBe(true);
    expect(service.verifyTotp(secret, '287082', 119_000)).toBe(false);
    expect(service.verifyTotp(secret, 'not-a-code', 59_000)).toBe(false);
  });

  it('encrypts secrets with authenticated encryption and rejects tampering', () => {
    const encrypted = service.encryptSecret('BASE32SECRET');

    expect(encrypted).not.toContain('BASE32SECRET');
    expect(service.decryptSecret(encrypted)).toBe('BASE32SECRET');
    expect(() => service.decryptSecret(encrypted.slice(0, -1) + 'A')).toThrow();
  });

  it('creates normalized one-time recovery codes and stable user-scoped hashes', () => {
    const codes = service.generateRecoveryCodes();

    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    expect(codes.every((code) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code))).toBe(true);
    expect(service.hashRecoveryCode('user-1', codes[0].toLowerCase())).toBe(
      service.hashRecoveryCode('user-1', codes[0]),
    );
    expect(service.hashRecoveryCode('user-2', codes[0])).not.toBe(
      service.hashRecoveryCode('user-1', codes[0]),
    );
  });
});
