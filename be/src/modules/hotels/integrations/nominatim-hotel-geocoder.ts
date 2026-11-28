import { createHash } from 'node:crypto';
import { Injectable, Logger, Optional, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import type { HotelGeocoder, HotelLocationResult } from '../interfaces/hotel-geocoder.interface';
import { HotelLocationRateLimitedException, HotelLocationUnavailableException } from '../exceptions/hotel-location.exceptions';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';

interface NominatimResult {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
}

@Injectable()
export class NominatimHotelGeocoder implements HotelGeocoder, OnModuleDestroy {
  private readonly logger = new Logger(NominatimHotelGeocoder.name);
  private readonly client: ReturnType<typeof createClient>;
  private ready?: Promise<unknown>;
  private readonly origin: string;
  private readonly userAgent: string;
  private readonly rateKey = 'tourism:hotel-location:provider-rate';

  constructor(config: ConfigService, @Optional() private readonly settings?: PlatformSettingsService) {
    const url = new URL('redis://localhost');
    url.protocol = config.get<boolean>('REDIS_TLS') ? 'rediss:' : 'redis:';
    url.hostname = config.get<string>('REDIS_HOST', 'localhost');
    url.port = String(config.get<number>('REDIS_PORT', 6379));
    url.pathname = `/${config.get<number>('REDIS_DB', 0)}`;
    url.username = config.get<string>('REDIS_USERNAME', '');
    url.password = config.get<string>('REDIS_PASSWORD', '');
    this.client = createClient({ url: url.toString(), socket: { connectTimeout: 3000 }, disableOfflineQueue: true });
    this.client.on('error', () => this.logger.warn('Hotel location cache unavailable'));
    this.origin = config.get<string>('HOTEL_GEOCODER_ORIGIN', 'https://nominatim.openstreetmap.org');
    this.userAgent = config.get<string>('HOTEL_GEOCODER_USER_AGENT', 'HanhTrinhViet/1.0 (+https://travellad.id.vn)');
  }

  async search(query: string): Promise<HotelLocationResult[]> {
    try {
      this.ready ??= this.client.connect().catch((error: unknown) => { this.ready = undefined; throw error; });
      await this.ready;
      const hash = createHash('sha256').update(`${this.origin}:${query.toLocaleLowerCase('vi-VN')}`).digest('hex');
      const cacheKey = `tourism:hotel-location:v1:${hash}`;
      const cached = await this.client.get(cacheKey);
      if (cached !== null) return JSON.parse(cached) as HotelLocationResult[];
      // Atomic and shared across backend replicas: at most one provider request
      // per 1.1 seconds for the entire application. No autocomplete or retries.
      const reserved = await this.client.set(this.rateKey, '1', { NX: true, PX: 1100 });
      if (!reserved) throw new HotelLocationRateLimitedException();
      const url = new URL('/search', this.origin);
      url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', countrycodes: 'vn', 'accept-language': 'vi,en' }).toString();
      const userAgent = this.settings?.get<string>('HOTEL_GEOCODER_USER_AGENT') ?? this.userAgent;
      const response = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' }, signal: AbortSignal.timeout(8000), redirect: 'error' });
      if (response.status === 429) {
        await this.client.set(this.rateKey, '1', { PX: 60000 });
        throw new HotelLocationRateLimitedException();
      }
      if (!response.ok) throw new HotelLocationUnavailableException();
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) throw new HotelLocationUnavailableException();
      const results = (payload as NominatimResult[]).flatMap(row => {
        if (!row || typeof row !== 'object' || typeof row.lat !== 'string' || !row.lat.trim() || typeof row.lon !== 'string' || !row.lon.trim() || typeof row.display_name !== 'string') return [];
        const latitude = Number(row.lat);
        const longitude = Number(row.lon);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !row.display_name.trim()) return [];
        return [{ id: `${row.osm_type ?? 'place'}:${row.osm_id ?? row.place_id}`, address: row.display_name, latitude, longitude }];
      }).slice(0, 5);
      await this.client.set(cacheKey, JSON.stringify(results), { EX: 86400 });
      return results;
    } catch (error) {
      if (error instanceof HotelLocationRateLimitedException || error instanceof HotelLocationUnavailableException) throw error;
      throw new HotelLocationUnavailableException();
    }
  }

  async onModuleDestroy() {
    if (this.client.isOpen) await this.client.quit();
  }
}
