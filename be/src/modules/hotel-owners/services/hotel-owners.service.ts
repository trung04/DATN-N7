import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from '../../users/services/users.service';
import { CreateHotelOwnerRequest } from '../dtos/requests/create-hotel-owner.request';
import { ListHotelOwnersRequest } from '../dtos/requests/list-hotel-owners.request';
import { UpdateHotelOwnerRequest } from '../dtos/requests/update-hotel-owner.request';
import { HotelOwnerEntity } from '../entities/hotel-owner.entity';
import {
  EmptyHotelOwnerUpdateException,
  HotelOwnerConflictException,
  HotelOwnerNotFoundException,
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
    await this.usersService.findById(input.userId);
    if (await this.repository.findByUserId(input.userId)) {
      throw new HotelOwnerConflictException(input.userId);
    }

    return this.repository.create({
      userId: input.userId,
      bankName: this.normalizeNullable(input.bankName),
      bankAccountNumber: this.normalizeNullable(input.bankAccountNumber),
      bankAccountHolder: this.normalizeNullable(input.bankAccountHolder),
    });
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

  async delete(userId: string): Promise<void> {
    const hotelOwner = await this.findByUserId(userId);
    await this.repository.delete(hotelOwner);
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
