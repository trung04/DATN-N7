import { TravelAiException } from '../../../exceptions/travel-ai.exceptions';
import type {
  PlaceSearchInput,
  PlaceSearchPage,
  PlanPreview,
  Recommendation,
} from '../../../interfaces/travel-ai.integration';

export function readPlaceSearch(
  value: unknown,
  input: PlaceSearchInput,
): PlaceSearchPage {
  const result = record(value);
  const total = number(result.total);
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    result.limit !== input.limit ||
    result.offset !== input.offset ||
    result.retrieval !== 'local_exact_bge_bm25_rrf'
  )
    invalid();

  const rows = list(result.results, input.limit).map(record);
  const ids = rows.map((row) => text(row.place_id, 128));
  if (
    ids.length !== Math.min(input.limit, Math.max(0, total - input.offset)) ||
    new Set(ids).size !== ids.length
  )
    invalid();
  return {
    ids,
    total,
    usedSemanticRanking: rows.some(
      (row) => typeof row.semantic_score === 'number',
    ),
  };
}

function invalid(): never {
  throw new TravelAiException('invalid');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid();
  return value as unknown[];
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    invalid();
  return value;
}

function texts(value: unknown, count: number, length: number): string[] {
  return list(value, count).map((item) => text(item, length));
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid();
  return value;
}

function placeType(value: unknown): Recommendation['type'] {
  if (value === 'Hotel' || value === 'Restaurant' || value === 'Attraction')
    return value;
  return invalid();
}

export function readRecommendations(
  value: unknown,
  userId: string,
): Recommendation[] {
  const result = record(value);
  if (result.user_id !== userId) invalid();

  return list(result.recommendations, 12).map((item) => {
    const row = record(item);
    return {
      placeId: text(row.place_id, 128),
      type: placeType(row.place_type),
      city: text(row.city, 120),
      score: number(row.score),
      reasons: texts(row.reasons, 50, 500),
    };
  });
}

export function readPreview(value: unknown, userId: string): PlanPreview {
  const envelope = record(value);
  const result = record(envelope.result);
  const id = text(envelope.draft_id, 128);
  if (
    result.user_id !== userId ||
    result.trip_id !== id ||
    result.preview_only !== true ||
    result.saved !== false ||
    result.timezone !== 'Asia/Ho_Chi_Minh' ||
    (result.status !== 'planned' && result.status !== 'partial')
  )
    invalid();

  return {
    id,
    startDate: text(result.start_date, 10),
    partySize: number(result.party_size),
    summary: text(result.summary, 2000),
    warnings: texts(result.warnings, 150, 1000),
    days: list(result.days, 10).map((item) => {
      const day = record(item);
      return {
        date: text(day.date, 10),
        activities: list(day.activities, 3).map((item) => {
          const activity = record(item);
          return {
            placeId: text(activity.place_id, 128),
            start: text(activity.start_time, 35),
            end: text(activity.end_time, 35),
            notes: texts(activity.notes, 50, 1000),
          };
        }),
      };
    }),
  };
}
