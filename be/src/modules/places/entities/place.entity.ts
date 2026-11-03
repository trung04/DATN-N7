import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

const decimalTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};

export enum PlaceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
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

  @Column({ type: 'varchar', length: 20 })
  status: PlaceStatus;

  @Column({
    name: 'search_document',
    type: 'text',
    select: false,
    insert: false,
    update: false,
  })
  searchDocument: string;

  @Column({
    name: 'average_rating',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  averageRating: number;

  @Column({
    name: 'external_provider_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  externalProviderId: string | null;

  @Column({
    name: 'opening_time',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  openingTime: string | null;
}
