export const TWO_FACTOR_CREDENTIAL_REPOSITORY = Symbol(
  'TWO_FACTOR_CREDENTIAL_REPOSITORY',
);

export interface TwoFactorCredential {
  userId: string;
  encryptedSecret: string;
  recoveryCodeHashes: string[];
}

export interface TwoFactorCredentialRepository {
  findByUserId(userId: string): Promise<TwoFactorCredential | null>;
  save(credential: TwoFactorCredential): Promise<TwoFactorCredential>;
  deleteByUserId(userId: string): Promise<void>;
}
