import { PasswordTooLongException } from '../../exceptions/user.exceptions';
import { BcryptPasswordHasher } from './bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('creates a verifiable hash without retaining plaintext', async () => {
    const password = 'Password123';
    const passwordHash = await hasher.hash(password);

    expect(passwordHash).not.toBe(password);
    await expect(hasher.verify(password, passwordHash)).resolves.toBe(true);
  });

  it('rejects passwords that bcrypt would truncate', async () => {
    await expect(
      hasher.hash('á'.repeat(40) + 'Password123'),
    ).rejects.toBeInstanceOf(PasswordTooLongException);
  });

  it('rejects an invalid or overlong password during verification', async () => {
    const passwordHash = await hasher.hash('Password123');

    await expect(hasher.verify('wrong-password', passwordHash)).resolves.toBe(
      false,
    );
    await expect(
      hasher.verify('á'.repeat(40) + 'Password123', passwordHash),
    ).resolves.toBe(false);
  });
});
