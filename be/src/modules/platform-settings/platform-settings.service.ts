import { BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AuthorizationDeniedException } from '../authorization/exceptions/authorization.exceptions';
import type { AuthorizationActor } from '../authorization/interfaces/authorization-actor.interface';
import { UserRole } from '../users/entities/user.entity';
import { isPlatformSection, platformSections } from './platform-settings.catalog';
import type { PlatformSection, SettingsReader, SettingValue } from './platform-settings.catalog';
import { PlatformSettingsRepository } from './platform-settings.repository';

type Values = Record<string, SettingValue>;
type StoredSection = { revision: number; updatedAt: Date; values: Values };

@Injectable()
export class PlatformSettingsService implements SettingsReader, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformSettingsService.name);
  private readonly sections = new Map<PlatformSection, StoredSection>();
  private readonly overrides = new Map<string, SettingValue>();
  private readonly key?: Buffer;
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly config: ConfigService, private readonly repository: PlatformSettingsRepository) {
    const secret = config.get<string>('SETTINGS_ENCRYPTION_KEY');
    if (secret && /^[0-9a-f]{64}$/i.test(secret)) this.key = Buffer.from(secret, 'hex');
  }

  async onModuleInit(): Promise<void> {
    await this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh().catch(() => this.logger.warn('Could not refresh platform settings.'));
    }, 15_000);
    this.refreshTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  get<T>(key: string, fallback?: T): T | undefined {
    if (this.overrides.has(key)) return this.overrides.get(key) as T;
    if (key === 'GOOGLE_REDIRECT_URI') {
      const configured = this.config.get<string>(key)?.trim();
      return (configured || new URL('/api/v1/auth/google/callback', this.config.getOrThrow<string>('FRONTEND_ORIGIN')).href) as T;
    }
    return this.config.get<T>(key) ?? fallback;
  }

  getOrThrow<T>(key: string, fallback?: T): T {
    const value = this.get<T>(key, fallback);
    if (value === undefined) return this.config.getOrThrow<T>(key);
    return value;
  }

  publicMapToken(): string | null {
    return this.get<string>('MAPBOX_PUBLIC_TOKEN') ?? null;
  }

  async list() {
    await this.refresh();
    return Object.keys(platformSections).filter(isPlatformSection).map(section => this.view(section));
  }

  async save(section: PlatformSection, revision: number, input: Record<string, unknown>, actor: AuthorizationActor) {
    if (actor.role !== UserRole.ADMIN) throw new AuthorizationDeniedException();
    if (!this.key) throw new ServiceUnavailableException('Máy chủ chưa có khóa mã hóa cấu hình.');
    await this.refresh();
    const previous = this.sections.get(section);
    if (revision !== (previous?.revision ?? 0)) this.conflict();
    const updates = this.validate(section, input);
    const values = { ...previous?.values, ...updates };
    const encrypted = this.encrypt(section, values);
    if (!await this.repository.save(section, encrypted, revision, actor.id)) this.conflict();
    await this.refresh();
    return this.view(section);
  }

  private view(section: PlatformSection) {
    const { label, description, fields } = platformSections[section];
    const stored = this.sections.get(section);
    return {
      section, label, description, revision: stored?.revision ?? 0, updatedAt: stored?.updatedAt ?? null,
      fields: fields.map(field => {
        const value = this.get<SettingValue>(field.key);
        const configured = value !== undefined && value !== '';
        return { ...field, configured, readOnly: Boolean(field.readOnly || this.fixedPayosClientId(field.key)),
          value: field.kind === 'secret' ? null : value ?? null };
      }),
    };
  }

  private fixedPayosClientId(key: string): boolean {
    return ['PAYOS_CLIENT_ID', 'PAYOS_PAYOUT_CLIENT_ID'].includes(key) && Boolean(this.get<string>(key)?.trim());
  }

  private validate(section: PlatformSection, input: Record<string, unknown>): Values {
    const updates: Values = {};
    const fields = platformSections[section].fields;
    for (const [key, raw] of Object.entries(input)) {
      const field = fields.find(candidate => candidate.key === key);
      if (!field || field.readOnly || this.fixedPayosClientId(key)) {
        throw new BadRequestException('Trường cấu hình không được phép cập nhật.');
      }
      if (field.kind === 'number' && typeof raw === 'number' && Number.isInteger(raw) && raw >= field.min! && raw <= field.max!) {
        updates[key] = raw;
      } else if (field.kind === 'boolean' && typeof raw === 'boolean') {
        updates[key] = raw;
      } else if ((field.kind === 'text' || field.kind === 'secret') && typeof raw === 'string' && raw.length <= 2048 &&
        [...raw].every(character => character >= ' ' && character !== '\u007f')) {
        const value = raw.trim();
        if (field.kind !== 'secret' || value) updates[key] = value;
      } else {
        throw new BadRequestException(`Giá trị của ${field.label} không hợp lệ.`);
      }
    }
    if (Object.keys(updates).length === 0) throw new BadRequestException('Hãy nhập giá trị cần cập nhật.');
    const text = (key: string) => String(updates[key] ?? this.get<string>(key) ?? '').trim();
    if ((section === 'payos-collection' || section === 'payos-payout') && !fields.every(field => text(field.key))) {
      throw new BadRequestException('Điền đủ Client ID, API Key và Checksum Key của payOS.');
    }
    if (section === 'google' && (!text('GOOGLE_CLIENT_ID') || !text('GOOGLE_CLIENT_SECRET'))) {
      throw new BadRequestException('Điền đủ Client ID và Client Secret của Google.');
    }
    if (section === 'email-account' && (!text('SMTP_HOST') || !text('EMAIL_FROM') ||
      Boolean(text('SMTP_USER')) !== Boolean(text('SMTP_PASSWORD')) || text('AUTH_OTP_PEPPER').length < 32)) {
      throw new BadRequestException('Email cần máy chủ SMTP, địa chỉ gửi, khóa OTP trên máy chủ và thông tin SMTP đầy đủ.');
    }
    if (section === 'map') {
      if (text('MAPBOX_PUBLIC_TOKEN') && !/^pk\.[A-Za-z0-9._-]{10,}$/.test(text('MAPBOX_PUBLIC_TOKEN'))) {
        throw new BadRequestException('Dùng token Mapbox công khai bắt đầu bằng pk.');
      }
      if (text('HOTEL_GEOCODER_USER_AGENT').length < 10) throw new BadRequestException('User-Agent cần ít nhất 10 ký tự.');
    }
    return updates;
  }

  private conflict(): never {
    throw new ConflictException('Cấu hình vừa được cập nhật. Hãy tải lại trước khi thử lại.');
  }

  private encrypt(section: PlatformSection, values: Values): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key!, iv);
    cipher.setAAD(Buffer.from(`platform-settings:${section}`));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(values), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
  }

  private decrypt(section: PlatformSection, encrypted: string): Values {
    try {
      const data = Buffer.from(encrypted, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', this.key!, data.subarray(0, 12));
      decipher.setAAD(Buffer.from(`platform-settings:${section}`));
      decipher.setAuthTag(data.subarray(12, 28));
      return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8')) as Values;
    } catch {
      throw new Error('Không đọc được cấu hình đã mã hóa trên máy chủ.');
    }
  }

  private async refresh(): Promise<void> {
    for (const row of await this.repository.findAll()) {
      if (!isPlatformSection(row.section) || (this.sections.get(row.section)?.revision ?? 0) >= row.revision) continue;
      const values = this.decrypt(row.section, row.encryptedValue);
      this.sections.set(row.section, { revision: row.revision, updatedAt: row.updatedAt, values });
      for (const [key, value] of Object.entries(values)) this.overrides.set(key, value);
    }
  }
}
