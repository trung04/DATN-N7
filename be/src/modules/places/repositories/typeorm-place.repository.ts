import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PlaceEntity } from '../entities/place.entity';
import { ExternalProviderConflictException } from '../exceptions/place.exceptions';
import type {
  CreatePlaceData,
  FindPlacesOptions,
  PlaceDetailsData,
  PlacePage,
  PlaceRepository,
  PlaceSummaryData,
} from '../interfaces/place.repository.interface';

interface PlaceCatalogRow {
  id: string;
  categories: Array<{ code: string; name: string }>;
  tags: string[];
  images: Array<{
    imageUrl: string;
    imageOrder: number;
    altText: string | null;
    attributionText: string | null;
  }>;
  price: { minPrice: number; maxPrice: number; currency: string } | null;
}

@Injectable()
export class TypeOrmPlaceRepository implements PlaceRepository {
  constructor(
    @InjectRepository(PlaceEntity)
    private readonly repository: Repository<PlaceEntity>,
  ) {}

  findById(id: string): Promise<PlaceEntity | null> {
    return this.repository.findOneBy({ id });
  }

  async findDetailsById(id: string): Promise<PlaceDetailsData | null> {
    const place = await this.findById(id);
    if (!place) return null;
    return this.toDetails(place, (await this.catalogRows([id])).get(id));
  }

  findByExternalProviderId(
    externalProviderId: string,
  ): Promise<PlaceEntity | null> {
    return this.repository.findOneBy({ externalProviderId });
  }

  async findPage(options: FindPlacesOptions): Promise<PlacePage> {
    const query = this.repository.createQueryBuilder('place');

    if (options.search) {
      query.andWhere(
        `"place"."search_document"
          @@ websearch_to_tsquery('simple', :search)`,
        { search: options.search },
      );
    }
    if (options.status) {
      query.andWhere('place.status = :status', { status: options.status });
    }
    if (options.countryCode) {
      query.andWhere('place.countryCode = :countryCode', {
        countryCode: options.countryCode,
      });
    }
    if (options.provinceCode) {
      query.andWhere('place.provinceCode = :provinceCode', {
        provinceCode: options.provinceCode,
      });
    }
    if (options.minRating !== undefined) {
      query.andWhere('place.averageRating >= :minRating', {
        minRating: options.minRating,
      });
    }

    const sortColumns: Record<FindPlacesOptions['sortBy'], string> = {
      name: 'place.name',
      averageRating: 'place.averageRating',
      status: 'place.status',
    };

    const [places, total] = await query
      .orderBy(sortColumns[options.sortBy], options.sortOrder)
      .addOrderBy('place.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    const catalog = await this.catalogRows(places.map((place) => place.id));
    return {
      items: places.map((place) => this.toSummary(place, catalog.get(place.id))),
      total,
    };
  }

  async create(data: CreatePlaceData): Promise<PlaceEntity> {
    try {
      return await this.repository.save(this.repository.create(data));
    } catch (error) {
      this.rethrowProviderConflict(error);
    }
  }

  async save(place: PlaceEntity): Promise<PlaceEntity> {
    try {
      return await this.repository.save(place);
    } catch (error) {
      this.rethrowProviderConflict(error);
    }
  }

  async delete(place: PlaceEntity): Promise<void> {
    await this.repository.softRemove(place);
  }

  private rethrowProviderConflict(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      throw new ExternalProviderConflictException();
    }
    throw error;
  }

  private async catalogRows(
    placeIds: string[],
  ): Promise<Map<string, PlaceCatalogRow>> {
    if (!placeIds.length) return new Map();
    const rows = (await this.repository.query(
      `
        SELECT
          p.id,
          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object('code', c.code, 'name', c.name)
              ORDER BY m.created_at, c.code
            )
            FROM place_category_mappings m
            JOIN place_categories c ON c.id = m.place_category_id
            WHERE m.place_id = p.id
              AND m.deleted_at IS NULL
              AND c.deleted_at IS NULL
          ), '[]'::jsonb) AS categories,
          COALESCE((
            SELECT jsonb_agg(t.name ORDER BY pt.created_at, t.code)
            FROM place_topics pt
            JOIN topics t ON t.id = pt.topic_id
            WHERE pt.place_id = p.id
              AND pt.deleted_at IS NULL
              AND t.deleted_at IS NULL
          ), '[]'::jsonb) AS tags,
          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'imageUrl', i.image_url,
                'imageOrder', pi.image_order,
                'altText', i.alt_text,
                'attributionText', i.attribution_text
              ) ORDER BY pi.image_order, pi.id
            )
            FROM place_images pi
            JOIN images i ON i.id = pi.image_id
            WHERE pi.place_id = p.id
              AND pi.deleted_at IS NULL
              AND i.deleted_at IS NULL
          ), '[]'::jsonb) AS images,
          (
            SELECT jsonb_build_object(
              'minPrice', rp.min_price,
              'maxPrice', rp.max_price,
              'currency', rp.currency
            )
            FROM reference_prices rp
            WHERE rp.place_id = p.id
              AND rp.deleted_at IS NULL
              AND (rp.valid_from IS NULL OR rp.valid_from <= CURRENT_DATE)
              AND (rp.valid_until IS NULL OR rp.valid_until >= CURRENT_DATE)
            ORDER BY
              CASE WHEN rp.cost_type = 'ADMISSION' THEN 0 ELSE 1 END,
              rp.valid_from DESC NULLS LAST,
              rp.id
            LIMIT 1
          ) AS price
        FROM places p
        WHERE p.id = ANY($1::uuid[])
      `,
      [placeIds],
    )) as PlaceCatalogRow[];
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toSummary(
    place: PlaceEntity,
    catalog?: PlaceCatalogRow,
  ): PlaceSummaryData {
    return {
      place,
      category: catalog?.categories[0]?.code ?? null,
      primaryImageUrl: catalog?.images[0]?.imageUrl ?? null,
      price: catalog?.price ?? null,
    };
  }

  private toDetails(
    place: PlaceEntity,
    catalog?: PlaceCatalogRow,
  ): PlaceDetailsData {
    return {
      ...this.toSummary(place, catalog),
      categories: catalog?.categories ?? [],
      tags: catalog?.tags ?? [],
      images: catalog?.images ?? [],
    };
  }
}
