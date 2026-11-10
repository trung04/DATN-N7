import { Inject, Injectable } from '@nestjs/common';
import { HotelOwnersService } from '../../hotel-owners/services/hotel-owners.service';
import { PlacesService } from '../../places/services/places.service';
import { UsersService } from '../../users/services/users.service';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import { CreateHotelDocumentRequest } from '../dtos/requests/create-hotel-document.request';
import { CreateHotelRequest } from '../dtos/requests/create-hotel.request';
import { ListHotelsRequest } from '../dtos/requests/list-hotels.request';
import {
  HotelReviewCommand,
  ReviewHotelRequest,
} from '../dtos/requests/review-hotel.request';
import { UpdateHotelRequest } from '../dtos/requests/update-hotel.request';
import {
  HotelDocumentEntity,
  HotelDocumentType,
} from '../entities/hotel-document.entity';
import {
  HotelReviewAction,
  HotelReviewHistoryEntity,
} from '../entities/hotel-review-history.entity';
import { HotelEntity, HotelStatus } from '../entities/hotel.entity';
import {
  EmptyHotelUpdateException,
  HotelDocumentLockedException,
  HotelDocumentNotFoundException,
  HotelLegalInformationLockedException,
  HotelNotActiveException,
  HotelNotFoundException,
  HotelSubmissionInvalidException,
  HotelTaxCodeConflictException,
  HotelUpdateLockedException,
  InvalidHotelStatusTransitionException,
} from '../exceptions/hotel.exceptions';
import { HOTEL_REPOSITORY } from '../interfaces/hotel.repository.interface';
import type {
  HotelPage,
  HotelRepository,
} from '../interfaces/hotel.repository.interface';

@Injectable()
export class HotelsService {
  constructor(
    @Inject(HOTEL_REPOSITORY)
    private readonly repository: HotelRepository,
    private readonly hotelOwnersService: HotelOwnersService,
    private readonly placesService: PlacesService,
    private readonly usersService: UsersService,
  ) {}

  async create(
    ownerUserId: string,
    input: CreateHotelRequest,
  ): Promise<HotelEntity> {
    await this.hotelOwnersService.findByUserId(ownerUserId);
    if (input.placeId) await this.placesService.findById(input.placeId);

    const taxCode = this.normalizeTaxCode(input.taxCode);
    if (await this.repository.findByTaxCode(taxCode)) {
      throw new HotelTaxCodeConflictException();
    }

    return this.repository.create({
      ownerUserId,
      placeId: input.placeId ?? null,
      name: input.name.trim(),
      legalName: input.legalName.trim(),
      taxCode,
      description: this.normalizeNullable(input.description),
      address: input.address.trim(),
      phoneNumber: input.phoneNumber.trim(),
      email: input.email.trim().toLowerCase(),
      starRating: input.starRating ?? null,
      checkInTime: input.checkInTime,
      checkOutTime: input.checkOutTime,
      status: HotelStatus.DRAFT,
    });
  }

  findPage(input: ListHotelsRequest): Promise<HotelPage> {
    return this.repository.findPage({
      page: input.page,
      limit: input.limit,
      search: input.search,
      ownerUserId: input.ownerUserId,
      placeId: input.placeId,
      status: input.status,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
  }

  findPublicPage(input: ListHotelsRequest): Promise<HotelPage> {
    const scoped = Object.assign(new ListHotelsRequest(), input);
    scoped.ownerUserId = undefined;
    scoped.status = HotelStatus.ACTIVE;
    return this.findPage(scoped);
  }

  findOwnedPage(
    input: ListHotelsRequest,
    ownerUserId: string,
  ): Promise<HotelPage> {
    const scoped = Object.assign(new ListHotelsRequest(), input);
    scoped.ownerUserId = ownerUserId;
    return this.findPage(scoped);
  }

  async findById(id: string): Promise<HotelEntity> {
    const hotel = await this.repository.findById(id);
    if (!hotel) throw new HotelNotFoundException(id);
    return hotel;
  }

  async findPublicById(id: string): Promise<HotelEntity> {
    return this.assertActive(id);
  }

  async assertActive(id: string): Promise<HotelEntity> {
    const hotel = await this.findById(id);
    if (hotel.status !== HotelStatus.ACTIVE) {
      throw new HotelNotActiveException(id);
    }
    return hotel;
  }

  async update(
    id: string,
    input: UpdateHotelRequest,
    actor: AuthorizationActor,
  ): Promise<HotelEntity> {
    if (this.isEmptyUpdate(input)) throw new EmptyHotelUpdateException();
    const hotel = await this.findById(id);
    this.assertCanManage(hotel, actor);
    if (hotel.status === HotelStatus.PENDING_APPROVAL) {
      throw new HotelUpdateLockedException();
    }
    if (
      hotel.status === HotelStatus.ACTIVE &&
      (input.legalName !== undefined || input.taxCode !== undefined)
    ) {
      throw new HotelLegalInformationLockedException();
    }

    if (input.placeId !== undefined && input.placeId !== null) {
      await this.placesService.findById(input.placeId);
    }
    if (input.taxCode !== undefined) {
      const taxCode = this.normalizeTaxCode(input.taxCode);
      const duplicate = await this.repository.findByTaxCode(taxCode);
      if (duplicate && duplicate.id !== hotel.id) {
        throw new HotelTaxCodeConflictException();
      }
      hotel.taxCode = taxCode;
    }

    this.applyUpdate(hotel, input);
    return this.repository.save(hotel);
  }

  async addDocument(
    hotelId: string,
    input: CreateHotelDocumentRequest,
    actor: AuthorizationActor,
  ): Promise<HotelDocumentEntity> {
    const hotel = await this.findById(hotelId);
    this.assertCanManage(hotel, actor);
    this.assertDocumentsMutable(hotel);
    this.assertDocumentDates(input.issuedAt ?? null, input.expiresAt ?? null);
    return this.repository.createDocument({
      hotelId,
      documentType: input.documentType,
      documentNumber: input.documentNumber.trim(),
      fileUrl: input.fileUrl.trim(),
      issuedAt: input.issuedAt ?? null,
      expiresAt: input.expiresAt ?? null,
    });
  }

  async deleteDocument(
    hotelId: string,
    documentId: string,
    actor: AuthorizationActor,
  ): Promise<void> {
    const hotel = await this.findById(hotelId);
    this.assertCanManage(hotel, actor);
    this.assertDocumentsMutable(hotel);
    const document = await this.repository.findDocumentById(documentId);
    if (!document || document.hotelId !== hotelId) {
      throw new HotelDocumentNotFoundException(documentId);
    }
    await this.repository.deleteDocument(document);
  }

  async submit(id: string, actor: AuthorizationActor): Promise<HotelEntity> {
    const hotel = await this.findById(id);
    this.assertCanManage(hotel, actor);
    if (
      hotel.status !== HotelStatus.DRAFT &&
      hotel.status !== HotelStatus.REJECTED
    ) {
      throw new InvalidHotelStatusTransitionException(
        hotel.status,
        HotelReviewAction.SUBMITTED,
      );
    }
    this.assertSubmissionReady(hotel);

    hotel.status = HotelStatus.PENDING_APPROVAL;
    hotel.submittedAt = new Date();
    hotel.reviewedAt = null;
    hotel.reviewedBy = null;
    hotel.rejectionReason = null;
    return this.repository.saveWithReview(hotel, {
      hotelId: hotel.id,
      actorUserId: hotel.ownerUserId,
      action: HotelReviewAction.SUBMITTED,
      reason: null,
    });
  }

  async review(
    id: string,
    reviewerUserId: string,
    input: ReviewHotelRequest,
  ): Promise<HotelEntity> {
    await this.usersService.findById(reviewerUserId);
    const hotel = await this.findById(id);
    const reason = this.normalizeNullable(input.reason);
    const action = this.applyReviewCommand(hotel, input.action, reason);
    hotel.reviewedAt = new Date();
    hotel.reviewedBy = reviewerUserId;

    return this.repository.saveWithReview(hotel, {
      hotelId: hotel.id,
      actorUserId: reviewerUserId,
      action,
      reason,
    });
  }

  async deactivate(
    id: string,
    actor: AuthorizationActor,
  ): Promise<HotelEntity> {
    const hotel = await this.findById(id);
    this.assertCanManage(hotel, actor);
    if (
      hotel.status !== HotelStatus.ACTIVE &&
      hotel.status !== HotelStatus.SUSPENDED
    ) {
      throw new InvalidHotelStatusTransitionException(
        hotel.status,
        HotelReviewAction.DEACTIVATED,
      );
    }
    hotel.status = HotelStatus.INACTIVE;
    return this.repository.saveWithReview(hotel, {
      hotelId: hotel.id,
      actorUserId: hotel.ownerUserId,
      action: HotelReviewAction.DEACTIVATED,
      reason: null,
    });
  }

  async findReviewHistory(id: string): Promise<HotelReviewHistoryEntity[]> {
    await this.findById(id);
    return this.repository.findReviewHistory(id);
  }

  async assertManagedBy(
    id: string,
    actor: AuthorizationActor,
  ): Promise<HotelEntity> {
    const hotel = await this.findById(id);
    this.assertCanManage(hotel, actor);
    return hotel;
  }

  private assertCanManage(hotel: HotelEntity, actor: AuthorizationActor): void {
    if (actor.role !== UserRole.ADMIN && hotel.ownerUserId !== actor.id) {
      throw new AuthorizationDeniedException();
    }
  }

  private applyReviewCommand(
    hotel: HotelEntity,
    command: HotelReviewCommand,
    reason: string | null,
  ): HotelReviewAction {
    if (command === HotelReviewCommand.APPROVE) {
      this.assertStatus(hotel, HotelStatus.PENDING_APPROVAL, command);
      this.assertSubmissionReady(hotel);
      hotel.status = HotelStatus.ACTIVE;
      hotel.rejectionReason = null;
      return HotelReviewAction.APPROVED;
    }
    if (command === HotelReviewCommand.REJECT) {
      this.assertStatus(hotel, HotelStatus.PENDING_APPROVAL, command);
      this.assertReason(reason);
      hotel.status = HotelStatus.REJECTED;
      hotel.rejectionReason = reason;
      return HotelReviewAction.REJECTED;
    }
    if (command === HotelReviewCommand.SUSPEND) {
      this.assertStatus(hotel, HotelStatus.ACTIVE, command);
      this.assertReason(reason);
      hotel.status = HotelStatus.SUSPENDED;
      return HotelReviewAction.SUSPENDED;
    }

    this.assertStatus(hotel, HotelStatus.SUSPENDED, command);
    this.assertSubmissionReady(hotel);
    hotel.status = HotelStatus.ACTIVE;
    hotel.rejectionReason = null;
    return HotelReviewAction.REACTIVATED;
  }

  private assertSubmissionReady(hotel: HotelEntity): void {
    const businessLicense = hotel.documents?.find(
      (document) =>
        document.documentType === HotelDocumentType.BUSINESS_LICENSE,
    );
    if (!businessLicense) {
      throw new HotelSubmissionInvalidException(
        'A business license is required before submitting the hotel.',
      );
    }
    if (
      businessLicense.expiresAt &&
      businessLicense.expiresAt < this.todayDate()
    ) {
      throw new HotelSubmissionInvalidException(
        'The business license has expired.',
      );
    }
  }

  private assertDocumentsMutable(hotel: HotelEntity): void {
    if (
      hotel.status !== HotelStatus.DRAFT &&
      hotel.status !== HotelStatus.REJECTED
    ) {
      throw new HotelDocumentLockedException();
    }
  }

  private assertDocumentDates(
    issuedAt: string | null,
    expiresAt: string | null,
  ): void {
    if (issuedAt && expiresAt && issuedAt > expiresAt) {
      throw new HotelSubmissionInvalidException(
        'Document expiration date must not be earlier than its issue date.',
      );
    }
  }

  private assertStatus(
    hotel: HotelEntity,
    expected: HotelStatus,
    action: HotelReviewCommand,
  ): void {
    if (hotel.status !== expected) {
      throw new InvalidHotelStatusTransitionException(hotel.status, action);
    }
  }

  private assertReason(reason: string | null): asserts reason is string {
    if (!reason) {
      throw new HotelSubmissionInvalidException(
        'A reason is required for this review action.',
      );
    }
  }

  private applyUpdate(hotel: HotelEntity, input: UpdateHotelRequest): void {
    if (input.placeId !== undefined) hotel.placeId = input.placeId;
    if (input.name !== undefined) hotel.name = input.name.trim();
    if (input.legalName !== undefined) hotel.legalName = input.legalName.trim();
    if (input.description !== undefined) {
      hotel.description = this.normalizeNullable(input.description);
    }
    if (input.address !== undefined) hotel.address = input.address.trim();
    if (input.phoneNumber !== undefined) {
      hotel.phoneNumber = input.phoneNumber.trim();
    }
    if (input.email !== undefined) {
      hotel.email = input.email.trim().toLowerCase();
    }
    if (input.starRating !== undefined) hotel.starRating = input.starRating;
    if (input.checkInTime !== undefined) hotel.checkInTime = input.checkInTime;
    if (input.checkOutTime !== undefined) {
      hotel.checkOutTime = input.checkOutTime;
    }
  }

  private isEmptyUpdate(input: UpdateHotelRequest): boolean {
    return [
      input.placeId,
      input.name,
      input.legalName,
      input.taxCode,
      input.description,
      input.address,
      input.phoneNumber,
      input.email,
      input.starRating,
      input.checkInTime,
      input.checkOutTime,
    ].every((value) => value === undefined);
  }

  private normalizeTaxCode(value: string): string {
    return value.trim().toUpperCase();
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }

  private todayDate(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
