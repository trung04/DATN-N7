import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

const decimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

const openingTimeTransformer: ValueTransformer = {
  // shortcut: the current API exposes one display string, use structured schedules when UC06 details are expanded.
  to: (value: string | null) => (value === null ? null : { display: value }),
  from: (value: unknown) => {
    if (value === null) return null;
    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as { display?: unknown }).display === 'string'
    ) {
      return (value as { display: string }).display;
    }
    return JSON.stringify(value);
  },
};

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
export class PlaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

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
    transformer: decimalTransformer,
  })
  latitude: number | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 7,
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

  @Column({
    name: 'opening_times',
    type: 'jsonb',
    nullable: true,
    transformer: openingTimeTransformer,
  })
  openingTime: string | null;

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
