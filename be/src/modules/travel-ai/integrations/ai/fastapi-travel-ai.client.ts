import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TravelAiException } from '../../exceptions/travel-ai.exceptions';
import type {
  PlanInput,
  PlanPreview,
  RecommendInput,
  Recommendation,
  TravelAiIntegration,
} from '../../interfaces/travel-ai.integration';
import {
  readPreview,
  readRecommendations,
} from './contracts/travel-ai.contract';

const maxResponseBytes = 2 * 1024 * 1024;
const maxConcurrentRequests = 6;

@Injectable()
export class FastApiTravelAiClient implements TravelAiIntegration {
  private readonly logger = new Logger(FastApiTravelAiClient.name);
  private readonly activeUsers = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  async recommend(input: RecommendInput): Promise<Recommendation[]> {
    const result = await this.post('/api/v1/recommendations', input.userId, {
      user_id: input.userId,
      mode: input.personalized ? 'auto' : 'content_rating',
      query: input.query,
      preferences: input.preferences,
      limit: 12,
    });
    return readRecommendations(result, input.userId);
  }

  async preview(input: PlanInput): Promise<PlanPreview> {
    const result = await this.post('/api/v1/trips/preview', input.userId, {
      user_id: input.userId,
      city: input.city,
      start_date: input.startDate,
      days: input.days,
      party_size: input.guests,
      preferences: input.preferences,
      query: input.query || null,
      stops_per_day: input.stopsPerDay,
      routing_provider: 'configured',
      allow_estimated_routes: true,
    });
    return readPreview(result, input.userId);
  }

  private async post(
    path: string,
    userId: string,
    body: object,
  ): Promise<unknown> {
    const key = this.config.getOrThrow<string>('AI_API_KEY').trim();
    if (!key) throw new TravelAiException('configuration');

    const baseUrl = this.config.getOrThrow<string>('AI_BASE_URL');
    const signal = AbortSignal.timeout(
      this.config.getOrThrow<number>('AI_TIMEOUT_MS'),
    );
    const startedAt = Date.now();
    let status: number | undefined;

    if (
      this.activeUsers.has(userId) ||
      this.activeUsers.size >= maxConcurrentRequests
    ) {
      throw new TravelAiException('throttled');
    }
    this.activeUsers.add(userId);
    try {
      const response = await fetch(new URL(path, baseUrl), {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify(body),
      });
      status = response.status;
      if (!response.ok) {
        await response.body?.cancel();
        if (status === 429) throw new TravelAiException('throttled');
        if (status === 504) throw new TravelAiException('timeout');
        if (status === 503) throw new TravelAiException('unavailable');
        if (status === 422 && path.endsWith('/trips/preview')) {
          throw new TravelAiException('noPlan');
        }
        throw new TravelAiException('upstream');
      }
      return await this.readJson(response);
    } catch (error) {
      const failure =
        error instanceof TravelAiException
          ? error
          : new TravelAiException(signal.aborted ? 'timeout' : 'unavailable');
      this.logger.warn({
        path,
        status,
        durationMs: Date.now() - startedAt,
        code: failure.code,
      });
      throw failure;
    } finally {
      this.activeUsers.delete(userId);
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    if (
      !response.body ||
      !response.headers.get('content-type')?.includes('application/json')
    ) {
      await response.body?.cancel();
      throw new TravelAiException('invalid');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxResponseBytes) {
          await reader.cancel();
          throw new TravelAiException('invalid');
        }
        text += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }

    try {
      return JSON.parse(text + decoder.decode()) as unknown;
    } catch {
      throw new TravelAiException('invalid');
    }
  }
}
