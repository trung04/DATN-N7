import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from '../../users/services/users.service';
import {
  TwoFactorAlreadyEnabledException,
  TwoFactorCodeInvalidException,
  TwoFactorNotConfiguredException,
} from '../exceptions/auth.exceptions';
import {
  TWO_FACTOR_CREDENTIAL_REPOSITORY,
  type TwoFactorCredential,
  type TwoFactorCredentialRepository,
} from '../interfaces/two-factor-credential.repository.interface';
import { TwoFactorCodeService } from './two-factor-code.service';

@Injectable()
export class TwoFactorService {
  constructor(
    @Inject(TWO_FACTOR_CREDENTIAL_REPOSITORY)
    private readonly credentials: TwoFactorCredentialRepository,
    private readonly codes: TwoFactorCodeService,
    private readonly users: UsersService,
  ) {}

  async beginSetup(
    userId: string,
  ): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.users.findActiveById(userId);
    if (!user) throw new TwoFactorNotConfiguredException();
    if (user.isTwoFactorEnabled) throw new TwoFactorAlreadyEnabledException();
    const secret = this.codes.generateSecret();
    await this.credentials.save({
      userId,
      encryptedSecret: this.codes.encryptSecret(secret),
      recoveryCodeHashes: [],
    });
    return {
      secret,
      otpauthUri: this.codes.buildOtpAuthUri(secret, user.email),
    };
  }

  async confirmSetup(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const credential = await this.requireCredential(userId);
    this.assertTotp(credential, code);
    const recoveryCodes = this.codes.generateRecoveryCodes();
    await this.credentials.save({
      ...credential,
      recoveryCodeHashes: recoveryCodes.map((recoveryCode) =>
        this.codes.hashRecoveryCode(userId, recoveryCode),
      ),
    });
    await this.users.setTwoFactorEnabled(userId, true);
    return { recoveryCodes };
  }

  async verifyCode(userId: string, code: string): Promise<void> {
    const credential = await this.requireCredential(userId);
    if (this.isValidTotp(credential, code)) return;

    const recoveryHash = this.codes.hashRecoveryCode(userId, code);
    const index = credential.recoveryCodeHashes.indexOf(recoveryHash);
    if (index < 0) throw new TwoFactorCodeInvalidException();
    await this.credentials.save({
      ...credential,
      recoveryCodeHashes: credential.recoveryCodeHashes.filter(
        (_, currentIndex) => currentIndex !== index,
      ),
    });
  }

  async disable(userId: string, code: string): Promise<void> {
    await this.verifyCode(userId, code);
    await this.credentials.deleteByUserId(userId);
    await this.users.setTwoFactorEnabled(userId, false);
  }

  async regenerateRecoveryCodes(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    await this.verifyCode(userId, code);
    const credential = await this.requireCredential(userId);
    const recoveryCodes = this.codes.generateRecoveryCodes();
    await this.credentials.save({
      ...credential,
      recoveryCodeHashes: recoveryCodes.map((recoveryCode) =>
        this.codes.hashRecoveryCode(userId, recoveryCode),
      ),
    });
    return { recoveryCodes };
  }

  private async requireCredential(
    userId: string,
  ): Promise<TwoFactorCredential> {
    const credential = await this.credentials.findByUserId(userId);
    if (!credential) throw new TwoFactorNotConfiguredException();
    return credential;
  }

  private assertTotp(credential: TwoFactorCredential, code: string): void {
    if (!this.isValidTotp(credential, code)) {
      throw new TwoFactorCodeInvalidException();
    }
  }

  private isValidTotp(
    credential: TwoFactorCredential,
    code: string,
  ): boolean {
    return this.codes.verifyTotp(
      this.codes.decryptSecret(credential.encryptedSecret),
      code,
    );
  }
}
