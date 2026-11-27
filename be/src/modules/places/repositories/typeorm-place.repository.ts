import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { PlaceEntity } from '../entities/place.entity';
import {
  ExternalProviderConflictException,
  InvalidPlaceCatalogValueException,
} from '../exceptions/place.exceptions';
import type {
  CreatePlaceData,
  FindPlacesOptions,
  FindMapPlacesOptions,
  PlaceDetailsData,
  PlaceCatalogOptions,
  PlaceCatalogWriteData,
  PlacePage,
  PlaceRepository,
  PlaceSummaryData,
  MapPlacePointData,
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
  price: { minPrice: number; maxPrice: number; currency: string; pricingUnit: string; description: string | null } | null;
}

@Injectable()
export class TypeOrmPlaceRepository implements PlaceRepository {
  constructor(
    @InjectRepository(PlaceEntity)
    private readonly repository: Repository<PlaceEntity>,
    private readonly dataSource: DataSource,
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
    if (options.city) {
      query.andWhere('place.city = :city', { city: options.city });
    }
    if (options.categoryCode) {
      query.andWhere(
        `EXISTS (
          SELECT 1
          FROM place_category_mappings mapping
          INNER JOIN place_categories category
            ON category.id = mapping.place_category_id
           AND category.deleted_at IS NULL
          WHERE mapping.place_id = place.id
            AND mapping.deleted_at IS NULL
            AND category.code = :categoryCode
        )`,
        { categoryCode: options.categoryCode },
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

    if (options.rankedIds) {
      query
        .andWhere('place.id = ANY(CAST(:rankedIds AS uuid[]))', {
          rankedIds: options.rankedIds,
        })
        .orderBy('array_position(CAST(:rankedIds AS uuid[]), place.id)', 'ASC');
    } else {
      query.orderBy(sortColumns[options.sortBy], options.sortOrder);
    }

    const [places, total] = await query
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

  async findMapPoints(
    options: FindMapPlacesOptions,
  ): Promise<MapPlacePointData[]> {
    const rows = (await this.repository.query(
      `
        SELECT
          place.id,
          place.name,
          category.code AS "categoryCode",
          category.name AS "categoryName",
          place.latitude,
          place.longitude
        FROM places place
        LEFT JOIN LATERAL (
          SELECT candidate.code, candidate.name
          FROM place_category_mappings mapping
          INNER JOIN place_categories candidate
            ON candidate.id = mapping.place_category_id
           AND candidate.deleted_at IS NULL
          WHERE mapping.place_id = place.id
            AND mapping.deleted_at IS NULL
          ORDER BY mapping.created_at, candidate.code
          LIMIT 1
        ) category ON TRUE
        WHERE place.deleted_at IS NULL
          AND place.status = 'ACTIVE'
          AND place.location IS NOT NULL
          AND ST_Intersects(
            place.location,
            ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
          )
          AND (
            cardinality($5::varchar[]) = 0
            OR EXISTS (
              SELECT 1
              FROM place_category_mappings selected_mapping
              INNER JOIN place_categories selected_category
                ON selected_category.id = selected_mapping.place_category_id
               AND selected_category.deleted_at IS NULL
              WHERE selected_mapping.place_id = place.id
                AND selected_mapping.deleted_at IS NULL
                AND selected_category.code = ANY($5::varchar[])
            )
          )
        ORDER BY place.average_rating DESC NULLS LAST,
                 place.review_count DESC,
                 place.id ASC
        LIMIT $6
      `,
      [
        options.west,
        options.south,
        options.east,
        options.north,
        options.categoryCodes,
        options.limit,
      ],
    )) as Array<{
      id: string;
      name: string;
      categoryCode: string | null;
      categoryName: string | null;
      latitude: string | number;
      longitude: string | number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      categoryCode: row.categoryCode,
      categoryName: row.categoryName,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    }));
  }

  async findCatalogOptions(): Promise<PlaceCatalogOptions> {
    const [cityRows, categories, topics] = (await Promise.all([
      this.repository.query(
        `SELECT DISTINCT city FROM places
         WHERE deleted_at IS NULL AND status = 'ACTIVE'
           AND city IS NOT NULL AND btrim(city) <> ''
         ORDER BY city`,
      ),
      this.repository.query(
        `SELECT code, name FROM place_categories WHERE deleted_at IS NULL ORDER BY name`,
      ),
      this.repository.query(
        `SELECT code, name FROM topics WHERE deleted_at IS NULL ORDER BY name`,
      ),
    ])) as [Array<{ city: string }>, PlaceCatalogOptions['categories'], PlaceCatalogOptions['topics']];
    return { cities: cityRows.map((row) => row.city), categories, topics };
  }

  async findPreferenceOptions(): Promise<PlaceCatalogOptions> {
    const [categories, topics] = (await Promise.all([
      this.repository.query(`
        SELECT DISTINCT category.code, category.name
        FROM place_categories category
        INNER JOIN place_category_mappings mapping
          ON mapping.place_category_id = category.id AND mapping.deleted_at IS NULL
        INNER JOIN places place
          ON place.id = mapping.place_id
          AND place.deleted_at IS NULL
          AND place.status = 'ACTIVE'
        WHERE category.deleted_at IS NULL
        ORDER BY category.name
      `),
      this.repository.query(`
        SELECT DISTINCT topic.code, topic.name
        FROM topics topic
        INNER JOIN place_topics mapping
          ON mapping.topic_id = topic.id AND mapping.deleted_at IS NULL
        INNER JOIN places place
          ON place.id = mapping.place_id
          AND place.deleted_at IS NULL
          AND place.status = 'ACTIVE'
        WHERE topic.deleted_at IS NULL
        ORDER BY topic.name
      `),
    ])) as [PlaceCatalogOptions['categories'], PlaceCatalogOptions['topics']];
    return { cities: [], categories, topics };
  }

  async create(data: CreatePlaceData, catalog: PlaceCatalogWriteData): Promise<PlaceEntity> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const place = await manager.getRepository(PlaceEntity).save(
          manager.getRepository(PlaceEntity).create(data),
        );
        await this.syncCatalog(manager, place.id, catalog);
        return place;
      });
    } catch (error) {
      this.rethrowProviderConflict(error);
    }
  }

  async save(place: PlaceEntity, catalog: PlaceCatalogWriteData): Promise<PlaceEntity> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const saved = await manager.getRepository(PlaceEntity).save(place);
        await this.syncCatalog(manager, saved.id, catalog);
        return saved;
      });
    } catch (error) {
      this.rethrowProviderConflict(error);
    }
  }

  async delete(place: PlaceEntity): Promise<void> {
    await this.repository.softRemove(place);
  }

  private async syncCatalog(
    manager: import('typeorm').EntityManager,
    placeId: string,
    catalog: PlaceCatalogWriteData,
  ): Promise<void> {
    if (catalog.categoryCodes !== undefined) {
      await manager.query(
        `UPDATE place_category_mappings SET deleted_at = now(), updated_at = now()
         WHERE place_id = $1 AND deleted_at IS NULL`,
        [placeId],
      );
      const categories = [...new Set(catalog.categoryCodes)];
      if (categories.length) {
        const rows = (await manager.query(
          `SELECT id, code FROM place_categories
           WHERE code = ANY($1::varchar[]) AND deleted_at IS NULL`,
          [categories],
        )) as Array<{ id: string; code: string }>;
        const found = new Set(rows.map((row) => row.code));
        const unknown = categories.filter((code) => !found.has(code));
        if (unknown.length) throw new InvalidPlaceCatalogValueException('category', unknown);
        for (const category of rows) {
          await manager.query(
            `INSERT INTO place_category_mappings (place_id, place_category_id)
             VALUES ($1, $2)`,
            [placeId, category.id],
          );
        }
      }
    }

    if (catalog.topicCodes !== undefined) {
      await manager.query(
        `UPDATE place_topics SET deleted_at = now(), updated_at = now()
         WHERE place_id = $1 AND deleted_at IS NULL`,
        [placeId],
      );
      const topics = [...new Set(catalog.topicCodes)];
      if (topics.length) {
        const rows = (await manager.query(
          `SELECT id, code FROM topics
           WHERE code = ANY($1::varchar[]) AND deleted_at IS NULL`,
          [topics],
        )) as Array<{ id: string; code: string }>;
        const found = new Set(rows.map((row) => row.code));
        const unknown = topics.filter((code) => !found.has(code));
        if (unknown.length) throw new InvalidPlaceCatalogValueException('topic', unknown);
        for (const topic of rows) {
          await manager.query(
            `INSERT INTO place_topics (place_id, topic_id) VALUES ($1, $2)`,
            [placeId, topic.id],
          );
        }
      }
    }

    if (catalog.imageUrl !== undefined) {
      await manager.query(
        `UPDATE place_images SET deleted_at = now(), updated_at = now()
         WHERE place_id = $1 AND deleted_at IS NULL`,
        [placeId],
      );
      if (catalog.imageUrl) {
        let images = (await manager.query(
          `SELECT id FROM images
           WHERE image_url = $1 AND deleted_at IS NULL LIMIT 1`,
          [catalog.imageUrl],
        )) as Array<{ id: string }>;
        let imageId = images[0]?.id;
        if (!imageId) {
          const inserted = (await manager.query(
            `INSERT INTO images (storage_provider, object_key, image_url, alt_text,
                                 source_provider, source_url, attribution_text,
                                 created_at, updated_at)
             VALUES ('EXTERNAL', NULL, $1, $2, $3, $1, NULL, now(), now())
             RETURNING id`,
            [catalog.imageUrl, catalog.imageAltText ?? null,
              catalog.imageUrl.startsWith('/images/') ? 'APP_ASSET' : 'EXTERNAL_URL'],
          )) as Array<{ id: string }>;
          imageId = inserted[0].id;
        } else if (catalog.imageAltText !== undefined) {
          await manager.query(
            `UPDATE images SET alt_text = $2, updated_at = now() WHERE id = $1`,
            [imageId, catalog.imageAltText],
          );
        }
        await manager.query(
          `INSERT INTO place_images (place_id, image_id, image_order)
           VALUES ($1, $2, 1)`,
          [placeId, imageId],
        );
      }
    } else if (catalog.imageAltText !== undefined) {
      await manager.query(
        `UPDATE images SET alt_text = $2, updated_at = now()
         WHERE id = (SELECT image_id FROM place_images
                     WHERE place_id = $1 AND deleted_at IS NULL
                     ORDER BY image_order, id LIMIT 1)`,
        [placeId, catalog.imageAltText],
      );
    }

    if (catalog.referencePrice !== undefined) {
      await manager.query(
        `UPDATE reference_prices SET deleted_at = now(), updated_at = now()
         WHERE place_id = $1 AND deleted_at IS NULL`,
        [placeId],
      );
      if (catalog.referencePrice) {
        const price = catalog.referencePrice;
        await manager.query(
          `INSERT INTO reference_prices (place_id, cost_type, min_price, max_price,
             currency, pricing_unit, description, price_source, created_at, updated_at)
           VALUES ($1, 'ADMISSION', $2, $3, $4, $5, $6, 'ADMIN', now(), now())`,
          [placeId, price.minPrice, price.maxPrice, price.currency,
            price.pricingUnit, price.description ?? null],
        );
      }
    }
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
              'currency', rp.currency,
              'pricingUnit', rp.pricing_unit,
              'description', rp.description
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
