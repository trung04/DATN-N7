import { Inject, Injectable } from '@nestjs/common';
import { HotelsService } from '../../hotels/services/hotels.service';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { CreateAmenityRequest } from '../dtos/requests/create-amenity.request';
import { ListAmenitiesRequest } from '../dtos/requests/list-amenities.request';
import { UpdateAmenityRequest } from '../dtos/requests/update-amenity.request';
import { AmenityEntity } from '../entities/amenity.entity';
import {
  AmenityCodeConflictException,
  AmenityNotFoundException,
  EmptyAmenityUpdateException,
} from '../exceptions/amenity.exceptions';
import { AMENITY_REPOSITORY } from '../interfaces/amenity.repository.interface';
import type {
  AmenityPage,
  AmenityRepository,
} from '../interfaces/amenity.repository.interface';

@Injectable()
export class AmenitiesService {
  constructor(
    @Inject(AMENITY_REPOSITORY)
    private readonly repository: AmenityRepository,
    private readonly hotelsService: HotelsService,
  ) {}

  async create(input: CreateAmenityRequest): Promise<AmenityEntity> {
    const code = this.normalizeCode(input.code);
    if (await this.repository.findByCode(code)) {
      throw new AmenityCodeConflictException(code);
    }

    return this.repository.create({
      code,
      name: input.name.trim(),
      hotelId: null,
    });
  }

  findPage(input: ListAmenitiesRequest): Promise<AmenityPage> {
    return this.repository.findPage({
      page: input.page,
      limit: input.limit,
      search: input.search,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
  }

  async findById(id: string): Promise<AmenityEntity> {
    const amenity = await this.repository.findById(id);
    if (!amenity || amenity.hotelId !== null) throw new AmenityNotFoundException(id);
    return amenity;
  }

  async findHotelPage(
    hotelId: string,
    input: ListAmenitiesRequest,
    actor: AuthorizationActor,
  ): Promise<AmenityPage> {
    await this.hotelsService.assertManagedBy(hotelId, actor);
    return this.repository.findPage({
      page: input.page, limit: input.limit, search: input.search,
      sortBy: input.sortBy, sortOrder: input.sortOrder, hotelId,
    });
  }

  async createForHotel(
    hotelId: string,
    input: CreateAmenityRequest,
    actor: AuthorizationActor,
  ): Promise<AmenityEntity> {
    await this.hotelsService.assertManagedBy(hotelId, actor);
    const code = this.normalizeCode(input.code);
    if (await this.repository.findByCode(code, hotelId)) {
      throw new AmenityCodeConflictException(code);
    }
    return this.repository.create({ code, name: input.name.trim(), hotelId });
  }

  async updateForHotel(
    hotelId: string,
    id: string,
    input: UpdateAmenityRequest,
    actor: AuthorizationActor,
  ): Promise<AmenityEntity> {
    await this.hotelsService.assertManagedBy(hotelId, actor);
    if (input.code === undefined && input.name === undefined) {
      throw new EmptyAmenityUpdateException();
    }
    const amenity = await this.repository.findById(id);
    if (!amenity || amenity.hotelId !== hotelId) throw new AmenityNotFoundException(id);
    if (input.code !== undefined) {
      const code = this.normalizeCode(input.code);
      const duplicate = await this.repository.findByCode(code, hotelId);
      if (duplicate && duplicate.id !== amenity.id) throw new AmenityCodeConflictException(code);
      amenity.code = code;
    }
    if (input.name !== undefined) amenity.name = input.name.trim();
    return this.repository.save(amenity);
  }

  async deleteForHotel(hotelId: string, id: string, actor: AuthorizationActor): Promise<void> {
    await this.hotelsService.assertManagedBy(hotelId, actor);
    const amenity = await this.repository.findById(id);
    if (!amenity || amenity.hotelId !== hotelId) throw new AmenityNotFoundException(id);
    await this.repository.delete(amenity);
  }

  async findByIds(ids: string[]): Promise<AmenityEntity[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];

    const amenities = await this.repository.findByIds(uniqueIds);
    const foundIds = new Set(amenities.map((amenity) => amenity.id));
    const missingId = uniqueIds.find((id) => !foundIds.has(id));
    if (missingId) throw new AmenityNotFoundException(missingId);

    const byId = new Map(amenities.map((amenity) => [amenity.id, amenity]));
    return uniqueIds.map((id) => byId.get(id)!);
  }

  async findByIdsForHotel(ids: string[], hotelId: string): Promise<AmenityEntity[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];
    const amenities = await this.repository.findByIdsForHotel(uniqueIds, hotelId);
    const foundIds = new Set(amenities.map(amenity => amenity.id));
    const missingId = uniqueIds.find(id => !foundIds.has(id));
    if (missingId) throw new AmenityNotFoundException(missingId);
    const byId = new Map(amenities.map(amenity => [amenity.id, amenity]));
    return uniqueIds.map(id => byId.get(id)!);
  }

  async findExistingByIds(ids: string[]): Promise<AmenityEntity[]> {
    const uniqueIds = [...new Set(ids)];
    return uniqueIds.length === 0 ? [] : this.repository.findByIds(uniqueIds);
  }

  async update(
    id: string,
    input: UpdateAmenityRequest,
  ): Promise<AmenityEntity> {
    if (input.code === undefined && input.name === undefined) {
      throw new EmptyAmenityUpdateException();
    }

    const amenity = await this.findById(id);

    if (input.code !== undefined) {
      const code = this.normalizeCode(input.code);
      const duplicate = await this.repository.findByCode(code);
      if (duplicate && duplicate.id !== amenity.id) {
        throw new AmenityCodeConflictException(code);
      }
      amenity.code = code;
    }
    if (input.name !== undefined) amenity.name = input.name.trim();

    return this.repository.save(amenity);
  }

  async delete(id: string): Promise<void> {
    const amenity = await this.findById(id);
    await this.repository.delete(amenity);
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }
}
