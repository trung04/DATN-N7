import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
  VersionColumn,
} from 'typeorm';

const decimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

export const PLACE_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type PlaceWeekday = (typeof PLACE_WEEKDAYS)[number];

export interface PlaceOpeningPeriod {
  start: string;
  end: string;
}

export interface PlaceOpeningHours {
  display?: string;
  weekly?: Partial<Record<PlaceWeekday, PlaceOpeningPeriod[]>>;
}

export enum PlaceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum PlaceSourceType {
  MANUAL = 'MANUAL',
  CRAWLED = 'CRAWLED',
  PROVIDER = 'PROVIDER',
}

@Entity({ name: 'places' })
@Index('IDX_places_status', ['status'])
@Index('IDX_places_country_code', ['countryCode'])
@Index('IDX_places_active_city', ['city'], {
  where: '"deleted_at" IS NULL AND "status" = \'ACTIVE\'',
})
export class PlaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  @Column({ name: 'country_code', type: 'char', length: 2, nullable: true })
  countryCode: string | null;

  @Column({
    name: 'province_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  provinceCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  timezone: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: decimalTransformer,
  })
  latitude: number | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: decimalTransformer,
  })
  longitude: number | null;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
    select: false,
    insert: false,
    update: false,
  })
  location: string | null;

  @Column({ type: 'varchar', length: 20, default: PlaceStatus.ACTIVE })
  status: PlaceStatus;

  @Column({
    name: 'average_rating',
    type: 'numeric',
    precision: 3,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  averageRating: number;

  @Column({ name: 'review_count', type: 'integer', default: 0 })
  reviewCount: number;

  @Column({
    name: 'opening_times',
    type: 'jsonb',
    nullable: true,
  })
  openingHours: PlaceOpeningHours | null;

  @Column({
    name: 'estimated_visit_duration_minutes',
    type: 'integer',
    nullable: true,
  })
  estimatedVisitDurationMinutes: number | null;

  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" })
  amenities: string[];

  @Column({
    name: 'best_visit_times',
    type: 'text',
    array: true,
    default: () => "'{}'::text[]",
  })
  bestVisitTimes: string[];

  @Column({
    name: 'suitable_for',
    type: 'text',
    array: true,
    default: () => "'{}'::text[]",
  })
  suitableFor: string[];

  @Column({ name: 'contact_phone', type: 'varchar', length: 50, nullable: true })
  contactPhone: string | null;

  @Column({ name: 'contact_website', type: 'text', nullable: true })
  contactWebsite: string | null;

  @Column({
    name: 'source_type',
    type: 'varchar',
    length: 20,
    default: PlaceSourceType.MANUAL,
  })
  sourceType: PlaceSourceType;

  @Column({
    name: 'source_provider',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sourceProvider: string | null;

  @Column({ name: 'provider_place_id', type: 'text', nullable: true })
  externalProviderId: string | null;

  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({ name: 'attribution_text', type: 'text', nullable: true })
  attributionText: string | null;

  @Column({ name: 'license_code', type: 'varchar', length: 50, nullable: true })
  licenseCode: string | null;

  @Column({ name: 'last_refreshed_at', type: 'timestamptz', nullable: true })
  lastRefreshedAt: Date | null;

  @VersionColumn({ name: 'catalog_version', type: 'integer', default: 1 })
  catalogVersion: number;

  @Column({
    name: 'search_document',
    type: 'tsvector',
    select: false,
    insert: false,
    update: false,
  })
  searchDocument: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
