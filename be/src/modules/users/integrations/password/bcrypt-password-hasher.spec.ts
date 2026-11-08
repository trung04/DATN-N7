import { compare } from 'bcryptjs';
import { PasswordTooLongException } from '../../exceptions/user.exceptions';
import { BcryptPasswordHasher } from './bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('creates a verifiable hash without retaining plaintext', async () => {
    const password = 'Password123';
    const passwordHash = await hasher.hash(password);

    expect(passwordHash).not.toBe(password);
    await expect(compare(password, passwordHash)).resolves.toBe(true);
  });

  it('rejects passwords that bcrypt would truncate', async () => {
    await expect(
      hasher.hash('á'.repeat(40) + 'Password123'),
    ).rejects.toBeInstanceOf(PasswordTooLongException);
  });
});
