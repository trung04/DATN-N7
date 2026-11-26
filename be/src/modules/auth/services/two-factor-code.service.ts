import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOTP_STEP_SECONDS = 30;

@Injectable()
export class TwoFactorCodeService {
  constructor(private readonly config: ConfigService) {}

  generateSecret(): string {
    return this.encodeBase32(randomBytes(20));
  }

  buildOtpAuthUri(secret: string, email: string): string {
    const issuer = 'HanhTrinhViet';
    const label = encodeURIComponent(`${issuer}:${email}`);
    const query = new URLSearchParams({
      secret,
      issuer,
      algorithm: 'SHA1',
      digits: '6',
      period: String(TOTP_STEP_SECONDS),
    });
    return `otpauth://totp/${label}?${query.toString()}`;
  }

  verifyTotp(secret: string, code: string, nowMs = Date.now()): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const counter = Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
    for (let offset = -1; offset <= 1; offset += 1) {
      const expected = this.totp(secret, counter + offset);
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
    }
    return false;
  }

  encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return ['v1', iv, tag, ciphertext]
      .map((value) =>
        typeof value === 'string' ? value : value.toString('base64url'),
      )
      .join('.');
  }

  decryptSecret(encrypted: string): string {
    const [version, ivValue, tagValue, ciphertextValue, extra] =
      encrypted.split('.');
    if (
      version !== 'v1' ||
      !ivValue ||
      !tagValue ||
      !ciphertextValue ||
      extra
    ) {
      throw new Error('Invalid encrypted two-factor secret.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  generateRecoveryCodes(): string[] {
    return Array.from({ length: 8 }, () => {
      const bytes = randomBytes(8);
      const value = Array.from(
        bytes,
        (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length],
      ).join('');
      return `${value.slice(0, 4)}-${value.slice(4)}`;
    });
  }

  hashRecoveryCode(userId: string, code: string): string {
    const pepper = this.config.getOrThrow<string>(
      'TWO_FACTOR_RECOVERY_PEPPER',
    );
    return createHmac('sha256', pepper)
      .update(`${userId}:${this.normalizeRecoveryCode(code)}`)
      .digest('hex');
  }

  private totp(secret: string, counter: number): string {
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', this.decodeBase32(secret))
      .update(counterBuffer)
      .digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    return String(binary % 1_000_000).padStart(6, '0');
  }

  private encodeBase32(input: Buffer): string {
    let bits = '';
    for (const byte of input) bits += byte.toString(2).padStart(8, '0');
    let result = '';
    for (let index = 0; index < bits.length; index += 5) {
      result += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
    }
    return result;
  }

  private decodeBase32(value: string): Buffer {
    const normalized = value.replace(/=+$/u, '').toUpperCase();
    if (!normalized || [...normalized].some((char) => !BASE32_ALPHABET.includes(char))) {
      throw new Error('Invalid base32 secret.');
    }
    let bits = '';
    for (const char of normalized) {
      bits += BASE32_ALPHABET.indexOf(char).toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) {
      bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
    }
    return Buffer.from(bytes);
  }

  private normalizeRecoveryCode(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/gu, '');
  }

  private encryptionKey(): Buffer {
    const encoded = this.config.getOrThrow<string>(
      'TWO_FACTOR_ENCRYPTION_KEY',
    );
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) {
      throw new Error('TWO_FACTOR_ENCRYPTION_KEY must decode to 32 bytes.');
    }
    return key;
  }
}
