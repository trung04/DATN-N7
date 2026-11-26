import { Inject, Injectable } from '@nestjs/common';
import {
  EmptyPlaceTaxonomyUpdateException,
  PlaceTaxonomyCodeConflictException,
  PlaceTaxonomyInUseException,
  PlaceTaxonomyNotFoundException,
} from '../exceptions/place.exceptions';
import {
  PLACE_TAXONOMY_REPOSITORY,
  type PlaceTaxonomyData,
  type PlaceTaxonomyKind,
  type PlaceTaxonomyRepository,
} from '../interfaces/place-taxonomy.repository.interface';

@Injectable()
export class PlaceTaxonomiesService {
  constructor(
    @Inject(PLACE_TAXONOMY_REPOSITORY)
    private readonly repository: PlaceTaxonomyRepository,
  ) {}

  list(kind: PlaceTaxonomyKind): Promise<PlaceTaxonomyData[]> {
    return this.repository.list(kind);
  }

  async create(
    kind: PlaceTaxonomyKind,
    input: { code: string; name: string; description?: string | null },
  ): Promise<PlaceTaxonomyData> {
    const code = input.code.trim().toUpperCase();
    if (await this.repository.findByCode(kind, code)) {
      throw new PlaceTaxonomyCodeConflictException(kind, code);
    }
    return this.repository.create(kind, {
      code,
      name: input.name.trim(),
      description: this.normalizeNullable(input.description),
    });
  }

  async update(
    kind: PlaceTaxonomyKind,
    id: string,
    input: { name?: string; description?: string | null },
  ): Promise<PlaceTaxonomyData> {
    const existing = await this.require(kind, id);
    if (input.name === undefined && input.description === undefined) {
      throw new EmptyPlaceTaxonomyUpdateException();
    }
    return this.repository.update(kind, existing.id, {
      name: input.name?.trim() ?? existing.name,
      description: input.description === undefined
        ? existing.description
        : this.normalizeNullable(input.description),
    });
  }

  async delete(kind: PlaceTaxonomyKind, id: string): Promise<void> {
    await this.require(kind, id);
    const references = await this.repository.countReferences(kind, id);
    if (references.places || references.preferences) {
      throw new PlaceTaxonomyInUseException(kind, references);
    }
    await this.repository.delete(kind, id);
  }

  private async require(kind: PlaceTaxonomyKind, id: string): Promise<PlaceTaxonomyData> {
    const value = await this.repository.findById(kind, id);
    if (!value) throw new PlaceTaxonomyNotFoundException(kind, id);
    return value;
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }
}
