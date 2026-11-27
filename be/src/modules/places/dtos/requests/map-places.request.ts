import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Matches,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

const parseBbox = ({ value }: { value: unknown }): unknown => {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value !== 'string') return value;
  return value.split(',').map((part) => Number(part.trim()));
};

const parseCategoryCodes = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return [];
  const values = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      values
        .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
};

@ValidatorConstraint({ name: 'mapBbox', async: false })
class MapBboxConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!Array.isArray(value) || value.length !== 4) return false;
    const [west, south, east, north] = value as number[];
    return (
      value.every((coordinate) => Number.isFinite(coordinate)) &&
      west >= -180 &&
      east <= 180 &&
      south >= -90 &&
      north <= 90 &&
      west < east &&
      south < north
    );
  }

  defaultMessage(): string {
    return 'bbox must contain west,south,east,north within valid coordinate ranges';
  }
}

export class MapPlacesRequest {
  @Transform(parseBbox)
  @Validate(MapBboxConstraint)
  bbox: [number, number, number, number];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(22)
  zoom: number;

  @Transform(parseCategoryCodes)
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(/^[A-Z0-9_-]{1,50}$/, { each: true })
  categoryCodes: string[] = [];
}
