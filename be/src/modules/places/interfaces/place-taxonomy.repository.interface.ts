export type PlaceTaxonomyKind = 'category' | 'topic';

export interface PlaceTaxonomyData {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface SavePlaceTaxonomyData {
  code: string;
  name: string;
  description: string | null;
}

export interface PlaceTaxonomyReferences {
  places: number;
  preferences: number;
}

export const PLACE_TAXONOMY_REPOSITORY = Symbol('PLACE_TAXONOMY_REPOSITORY');

export interface PlaceTaxonomyRepository {
  list(kind: PlaceTaxonomyKind): Promise<PlaceTaxonomyData[]>;
  findById(kind: PlaceTaxonomyKind, id: string): Promise<PlaceTaxonomyData | null>;
  findByCode(kind: PlaceTaxonomyKind, code: string): Promise<PlaceTaxonomyData | null>;
  create(kind: PlaceTaxonomyKind, input: SavePlaceTaxonomyData): Promise<PlaceTaxonomyData>;
  update(kind: PlaceTaxonomyKind, id: string, input: Omit<SavePlaceTaxonomyData, 'code'>): Promise<PlaceTaxonomyData>;
  countReferences(kind: PlaceTaxonomyKind, id: string): Promise<PlaceTaxonomyReferences>;
  delete(kind: PlaceTaxonomyKind, id: string): Promise<void>;
}
