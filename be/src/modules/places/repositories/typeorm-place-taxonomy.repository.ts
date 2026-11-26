import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  PlaceTaxonomyData,
  PlaceTaxonomyKind,
  PlaceTaxonomyReferences,
  PlaceTaxonomyRepository,
  SavePlaceTaxonomyData,
} from '../interfaces/place-taxonomy.repository.interface';

type CountRow = { count: string | number };

@Injectable()
export class TypeOrmPlaceTaxonomyRepository implements PlaceTaxonomyRepository {
  constructor(private readonly dataSource: DataSource) {}

  async list(kind: PlaceTaxonomyKind): Promise<PlaceTaxonomyData[]> {
    return this.dataSource.query(
      `SELECT id, code, name, ${kind === 'category' ? 'description' : 'NULL::text AS description'}
       FROM ${this.table(kind)} WHERE deleted_at IS NULL ORDER BY name, id`,
    ) as Promise<PlaceTaxonomyData[]>;
  }

  async findById(kind: PlaceTaxonomyKind, id: string): Promise<PlaceTaxonomyData | null> {
    const rows = await this.dataSource.query(
      `SELECT id, code, name, ${kind === 'category' ? 'description' : 'NULL::text AS description'}
       FROM ${this.table(kind)} WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    ) as PlaceTaxonomyData[];
    return rows[0] ?? null;
  }

  async findByCode(kind: PlaceTaxonomyKind, code: string): Promise<PlaceTaxonomyData | null> {
    const rows = await this.dataSource.query(
      `SELECT id, code, name, ${kind === 'category' ? 'description' : 'NULL::text AS description'}
       FROM ${this.table(kind)} WHERE code = $1 AND deleted_at IS NULL`,
      [code],
    ) as PlaceTaxonomyData[];
    return rows[0] ?? null;
  }

  async create(kind: PlaceTaxonomyKind, input: SavePlaceTaxonomyData): Promise<PlaceTaxonomyData> {
    const rows = kind === 'category'
      ? await this.dataSource.query(
        `INSERT INTO place_categories (code, name, description) VALUES ($1, $2, $3)
         RETURNING id, code, name, description`,
        [input.code, input.name, input.description],
      ) as PlaceTaxonomyData[]
      : await this.dataSource.query(
        `INSERT INTO topics (code, name) VALUES ($1, $2)
         RETURNING id, code, name, NULL::text AS description`,
        [input.code, input.name],
      ) as PlaceTaxonomyData[];
    return rows[0]!;
  }

  async update(
    kind: PlaceTaxonomyKind,
    id: string,
    input: Omit<SavePlaceTaxonomyData, 'code'>,
  ): Promise<PlaceTaxonomyData> {
    const rows = kind === 'category'
      ? await this.dataSource.query(
        `UPDATE place_categories SET name = $2, description = $3, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL RETURNING id, code, name, description`,
        [id, input.name, input.description],
      ) as PlaceTaxonomyData[]
      : await this.dataSource.query(
        `UPDATE topics SET name = $2, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL RETURNING id, code, name, NULL::text AS description`,
        [id, input.name],
      ) as PlaceTaxonomyData[];
    return rows[0]!;
  }

  async countReferences(kind: PlaceTaxonomyKind, id: string): Promise<PlaceTaxonomyReferences> {
    const [placeRows, preferenceRows] = await Promise.all([
      this.dataSource.query(
        kind === 'category'
          ? `SELECT count(*)::int AS count FROM place_category_mappings WHERE place_category_id = $1 AND deleted_at IS NULL`
          : `SELECT count(*)::int AS count FROM place_topics WHERE topic_id = $1 AND deleted_at IS NULL`,
        [id],
      ) as Promise<CountRow[]>,
      this.dataSource.query(
        kind === 'category'
          ? `SELECT count(*)::int AS count FROM travel_preference_categories WHERE place_category_id = $1 AND deleted_at IS NULL`
          : `SELECT count(*)::int AS count FROM travel_preference_topics WHERE topic_id = $1 AND deleted_at IS NULL`,
        [id],
      ) as Promise<CountRow[]>,
    ]);
    return {
      places: Number(placeRows[0]?.count ?? 0),
      preferences: Number(preferenceRows[0]?.count ?? 0),
    };
  }

  async delete(kind: PlaceTaxonomyKind, id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE ${this.table(kind)} SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  private table(kind: PlaceTaxonomyKind): 'place_categories' | 'topics' {
    return kind === 'category' ? 'place_categories' : 'topics';
  }
}
