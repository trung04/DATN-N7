import { UserEntity, UserStatus } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import type {
  TwoFactorCredential,
  TwoFactorCredentialRepository,
} from '../interfaces/two-factor-credential.repository.interface';
import { TwoFactorCodeInvalidException } from '../exceptions/auth.exceptions';
import { TwoFactorCodeService } from './two-factor-code.service';
import { TwoFactorService } from './two-factor.service';

describe('TwoFactorService', () => {
  let credentials: jest.Mocked<TwoFactorCredentialRepository>;
  let codes: jest.Mocked<TwoFactorCodeService>;
  let users: { findActiveById: jest.Mock; setTwoFactorEnabled: jest.Mock };
  let service: TwoFactorService;
  const user = Object.assign(new UserEntity(), {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'traveler@example.com',
    status: UserStatus.ACTIVE,
    isTwoFactorEnabled: false,
  });
  const credential: TwoFactorCredential = {
    userId: user.id,
    encryptedSecret: 'encrypted-secret',
    recoveryCodeHashes: [],
  };

  beforeEach(() => {
    credentials = {
      findByUserId: jest.fn(),
      save: jest.fn(),
      deleteByUserId: jest.fn(),
    };
    codes = {
      generateSecret: jest.fn().mockReturnValue('BASE32SECRET'),
      buildOtpAuthUri: jest.fn().mockReturnValue('otpauth://totp/HanhTrinhViet:traveler'),
      encryptSecret: jest.fn().mockReturnValue('encrypted-secret'),
      decryptSecret: jest.fn().mockReturnValue('BASE32SECRET'),
      verifyTotp: jest.fn(),
      generateRecoveryCodes: jest.fn().mockReturnValue(['ABCD-EFGH', 'IJKL-MNOP']),
      hashRecoveryCode: jest.fn((userId: string, code: string) => `${userId}:${code}`),
    } as unknown as jest.Mocked<TwoFactorCodeService>;
    users = { findActiveById: jest.fn().mockResolvedValue(user), setTwoFactorEnabled: jest.fn() };
    service = new TwoFactorService(
      credentials,
      codes,
      users as unknown as UsersService,
    );
  });

  it('stores a pending encrypted secret and returns an authenticator URI', async () => {
    credentials.findByUserId.mockResolvedValue(null);

    await expect(service.beginSetup(user.id)).resolves.toEqual({
      secret: 'BASE32SECRET',
      otpauthUri: 'otpauth://totp/HanhTrinhViet:traveler',
    });
    expect(credentials.save).toHaveBeenCalledWith(credential);
  });

  it('enables 2FA only after a valid TOTP and returns recovery codes once', async () => {
    credentials.findByUserId.mockResolvedValue(credential);
    codes.verifyTotp.mockReturnValue(true);

    await expect(service.confirmSetup(user.id, '123456')).resolves.toEqual({
      recoveryCodes: ['ABCD-EFGH', 'IJKL-MNOP'],
    });
    expect(credentials.save).toHaveBeenCalledWith({
      ...credential,
      recoveryCodeHashes: [`${user.id}:ABCD-EFGH`, `${user.id}:IJKL-MNOP`],
    });
    expect(users.setTwoFactorEnabled).toHaveBeenCalledWith(user.id, true);
  });

  it('consumes a recovery code once and rejects an invalid code', async () => {
    const active = { ...credential, recoveryCodeHashes: [`${user.id}:ABCD-EFGH`] };
    credentials.findByUserId.mockResolvedValue(active);
    codes.verifyTotp.mockReturnValue(false);

    await expect(service.verifyCode(user.id, 'abcd-efgh')).resolves.toBeUndefined();
    expect(credentials.save).toHaveBeenCalledWith({ ...active, recoveryCodeHashes: [] });

    credentials.findByUserId.mockResolvedValue({ ...active, recoveryCodeHashes: [] });
    await expect(service.verifyCode(user.id, 'abcd-efgh')).rejects.toBeInstanceOf(
      TwoFactorCodeInvalidException,
    );
  });

  it('requires a valid code before disabling and removes the stored credential', async () => {
    credentials.findByUserId.mockResolvedValue(credential);
    codes.verifyTotp.mockReturnValue(true);

    await service.disable(user.id, '123456');

    expect(credentials.deleteByUserId).toHaveBeenCalledWith(user.id);
    expect(users.setTwoFactorEnabled).toHaveBeenCalledWith(user.id, false);
  });
});
