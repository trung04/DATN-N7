import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from '../../users/services/users.service';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import { HotelOwnerEntity } from '../../users/entities/hotel-owner.entity';
import { CreateHotelOwnerRequest } from '../dtos/requests/create-hotel-owner.request';
import { ListHotelOwnersRequest } from '../dtos/requests/list-hotel-owners.request';
import { UpdateHotelOwnerRequest } from '../dtos/requests/update-hotel-owner.request';
import {
  EmptyHotelOwnerUpdateException,
  HotelOwnerConflictException,
  HotelOwnerNotFoundException,
  HotelOwnerRoleConflictException,
} from '../exceptions/hotel-owner.exceptions';
import { HOTEL_OWNER_REPOSITORY } from '../interfaces/hotel-owner.repository.interface';
import type {
  HotelOwnerPage,
  HotelOwnerRepository,
} from '../interfaces/hotel-owner.repository.interface';

@Injectable()
export class HotelOwnersService {
  constructor(
    @Inject(HOTEL_OWNER_REPOSITORY)
    private readonly repository: HotelOwnerRepository,
    private readonly usersService: UsersService,
  ) {}

  async create(input: CreateHotelOwnerRequest): Promise<HotelOwnerEntity> {
    const user = await this.usersService.findById(input.userId);
    if (user.role === UserRole.ADMIN) {
      throw new HotelOwnerRoleConflictException();
    }
    if (await this.repository.findByUserId(input.userId)) {
      throw new HotelOwnerConflictException(input.userId);
    }

    const hotelOwner = await this.repository.create({
      userId: input.userId,
      bankName: this.normalizeNullable(input.bankName),
      bankAccountNumber: this.normalizeNullable(input.bankAccountNumber),
      bankAccountHolder: this.normalizeNullable(input.bankAccountHolder),
    });
    await this.usersService.assignRole(input.userId, UserRole.HOTEL_OWNER);
    return hotelOwner;
  }

  findPage(input: ListHotelOwnersRequest): Promise<HotelOwnerPage> {
    return this.repository.findPage({
      page: input.page,
      limit: input.limit,
      search: input.search,
      userId: input.userId,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
  }

  async findByUserId(userId: string): Promise<HotelOwnerEntity> {
    const hotelOwner = await this.repository.findByUserId(userId);
    if (!hotelOwner) throw new HotelOwnerNotFoundException(userId);
    return hotelOwner;
  }

  async findByUserIdForActor(
    userId: string,
    actor: AuthorizationActor,
  ): Promise<HotelOwnerEntity> {
    this.assertSelfOrAdmin(userId, actor);
    return this.findByUserId(userId);
  }

  async update(
    userId: string,
    input: UpdateHotelOwnerRequest,
  ): Promise<HotelOwnerEntity> {
    if (this.isEmptyUpdate(input)) {
      throw new EmptyHotelOwnerUpdateException();
    }
    const hotelOwner = await this.findByUserId(userId);

    if (input.bankName !== undefined) {
      hotelOwner.bankName = this.normalizeNullable(input.bankName);
    }
    if (input.bankAccountNumber !== undefined) {
      hotelOwner.bankAccountNumber = this.normalizeNullable(
        input.bankAccountNumber,
      );
    }
    if (input.bankAccountHolder !== undefined) {
      hotelOwner.bankAccountHolder = this.normalizeNullable(
        input.bankAccountHolder,
      );
    }

    return this.repository.save(hotelOwner);
  }

  async updateForActor(
    userId: string,
    input: UpdateHotelOwnerRequest,
    actor: AuthorizationActor,
  ): Promise<HotelOwnerEntity> {
    this.assertSelfOrAdmin(userId, actor);
    return this.update(userId, input);
  }

  async delete(userId: string): Promise<void> {
    const hotelOwner = await this.findByUserId(userId);
    await this.repository.delete(hotelOwner);
  }

  private assertSelfOrAdmin(userId: string, actor: AuthorizationActor): void {
    if (actor.role !== UserRole.ADMIN && actor.id !== userId) {
      throw new AuthorizationDeniedException();
    }
  }

  private isEmptyUpdate(input: UpdateHotelOwnerRequest): boolean {
    return [
      input.bankName,
      input.bankAccountNumber,
      input.bankAccountHolder,
    ].every((value) => value === undefined);
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }
}
