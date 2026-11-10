import { HotelOwnersService } from '../../hotel-owners/services/hotel-owners.service';
import { PlacesService } from '../../places/services/places.service';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/entities/user.entity';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { HotelReviewCommand } from '../dtos/requests/review-hotel.request';
import {
  HotelDocumentEntity,
  HotelDocumentType,
} from '../entities/hotel-document.entity';
import { HotelReviewAction } from '../entities/hotel-review-history.entity';
import { HotelEntity, HotelStatus } from '../entities/hotel.entity';
import {
  HotelDocumentLockedException,
  HotelLegalInformationLockedException,
  HotelNotActiveException,
  HotelSubmissionInvalidException,
  InvalidHotelStatusTransitionException,
} from '../exceptions/hotel.exceptions';
import type { HotelRepository } from '../interfaces/hotel.repository.interface';
import { HotelsService } from './hotels.service';

const hotelId = '11111111-1111-4111-8111-111111111111';
const ownerUserId = '22222222-2222-4222-8222-222222222222';
const reviewerUserId = '33333333-3333-4333-8333-333333333333';
const ownerActor = { id: ownerUserId, role: UserRole.HOTEL_OWNER };

const document = (
  overrides: Partial<HotelDocumentEntity> = {},
): HotelDocumentEntity =>
  Object.assign(new HotelDocumentEntity(), {
    id: '44444444-4444-4444-8444-444444444444',
    hotelId,
    documentType: HotelDocumentType.BUSINESS_LICENSE,
    documentNumber: 'BL-001',
    fileUrl: 'https://files.example.com/business-license.pdf',
    issuedAt: '2026-01-01',
    expiresAt: '2030-01-01',
    createdAt: new Date('2026-11-08T00:00:00.000Z'),
    updatedAt: new Date('2026-11-08T00:00:00.000Z'),
    ...overrides,
  });

const hotel = (overrides: Partial<HotelEntity> = {}): HotelEntity =>
  Object.assign(new HotelEntity(), {
    id: hotelId,
    ownerUserId,
    placeId: null,
    name: 'Sun Hotel',
    legalName: 'Sun Hotel Company',
    taxCode: 'TAX001',
    description: null,
    address: '1 Beach Road',
    phoneNumber: '0912345678',
    email: 'hotel@example.com',
    starRating: 4,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    status: HotelStatus.DRAFT,
    submittedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    documents: [],
    createdAt: new Date('2026-11-08T00:00:00.000Z'),
    updatedAt: new Date('2026-11-08T00:00:00.000Z'),
    ...overrides,
  });

describe('HotelsService', () => {
  let repository: jest.Mocked<HotelRepository>;
  let hotelOwnersService: jest.Mocked<Pick<HotelOwnersService, 'findByUserId'>>;
  let placesService: jest.Mocked<Pick<PlacesService, 'findById'>>;
  let usersService: jest.Mocked<Pick<UsersService, 'findById'>>;
  let service: HotelsService;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByTaxCode: jest.fn(),
      findPage: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      saveWithReview: jest.fn(),
      createDocument: jest.fn(),
      findDocumentById: jest.fn(),
      deleteDocument: jest.fn(),
      findReviewHistory: jest.fn(),
    };
    hotelOwnersService = { findByUserId: jest.fn() };
    placesService = { findById: jest.fn() };
    usersService = { findById: jest.fn() };
    service = new HotelsService(
      repository,
      hotelOwnersService as unknown as HotelOwnersService,
      placesService as unknown as PlacesService,
      usersService as unknown as UsersService,
    );
  });

  it('creates a hotel in draft status', async () => {
    const saved = hotel();
    repository.create.mockResolvedValue(saved);

    await expect(
      service.create(ownerUserId, {
        name: ' Sun Hotel ',
        legalName: ' Sun Hotel Company ',
        taxCode: ' tax001 ',
        address: ' 1 Beach Road ',
        phoneNumber: '0912345678',
        email: ' HOTEL@example.com ',
        starRating: 4,
        checkInTime: '14:00',
        checkOutTime: '12:00',
      }),
    ).resolves.toBe(saved);

    expect(hotelOwnersService.findByUserId.mock.calls[0]).toEqual([
      ownerUserId,
    ]);
    expect(repository.create.mock.calls[0]).toEqual([
      expect.objectContaining({
        status: HotelStatus.DRAFT,
        taxCode: 'TAX001',
        email: 'hotel@example.com',
      }),
    ]);
  });

  it('submits a hotel with a valid business license without rooms or policies', async () => {
    const existing = hotel({ documents: [document()] });
    repository.findById.mockResolvedValue(existing);
    repository.saveWithReview.mockImplementation(async (value) => value);

    const submitted = await service.submit(hotelId, ownerActor);

    expect(submitted.status).toBe(HotelStatus.PENDING_APPROVAL);
    expect(repository.saveWithReview.mock.calls[0]).toEqual([
      existing,
      expect.objectContaining({
        actorUserId: ownerUserId,
        action: HotelReviewAction.SUBMITTED,
      }),
    ]);
  });

  it('does not submit a hotel without a business license', async () => {
    repository.findById.mockResolvedValue(hotel());

    await expect(service.submit(hotelId, ownerActor)).rejects.toBeInstanceOf(
      HotelSubmissionInvalidException,
    );
  });

  it('approves only a pending hotel with valid documents', async () => {
    const pending = hotel({
      status: HotelStatus.PENDING_APPROVAL,
      documents: [document()],
    });
    repository.findById.mockResolvedValue(pending);
    repository.saveWithReview.mockImplementation(async (value) => value);

    const approved = await service.review(hotelId, reviewerUserId, {
      action: HotelReviewCommand.APPROVE,
    });

    expect(approved.status).toBe(HotelStatus.ACTIVE);
    expect(approved.reviewedBy).toBe(reviewerUserId);
    expect(repository.saveWithReview.mock.calls[0]).toEqual([
      pending,
      expect.objectContaining({ action: HotelReviewAction.APPROVED }),
    ]);
  });

  it('rejects an invalid approval transition', async () => {
    repository.findById.mockResolvedValue(
      hotel({ status: HotelStatus.DRAFT, documents: [document()] }),
    );

    await expect(
      service.review(hotelId, reviewerUserId, {
        action: HotelReviewCommand.APPROVE,
      }),
    ).rejects.toBeInstanceOf(InvalidHotelStatusTransitionException);
  });

  it('locks approved legal information and documents', async () => {
    repository.findById.mockResolvedValue(
      hotel({ status: HotelStatus.ACTIVE, documents: [document()] }),
    );

    await expect(
      service.update(hotelId, { legalName: 'New Legal Name' }, ownerActor),
    ).rejects.toBeInstanceOf(HotelLegalInformationLockedException);
    await expect(
      service.addDocument(
        hotelId,
        {
          documentType: HotelDocumentType.OTHER,
          documentNumber: 'OTHER-1',
          fileUrl: 'https://files.example.com/other.pdf',
        },
        ownerActor,
      ),
    ).rejects.toBeInstanceOf(HotelDocumentLockedException);
  });

  it('rejects dependent operations for a hotel that is not active', async () => {
    repository.findById.mockResolvedValue(
      hotel({ status: HotelStatus.PENDING_APPROVAL }),
    );

    await expect(service.assertActive(hotelId)).rejects.toBeInstanceOf(
      HotelNotActiveException,
    );
  });

  it('does not let another hotel owner update the hotel', async () => {
    repository.findById.mockResolvedValue(hotel());

    await expect(
      service.update(
        hotelId,
        { name: 'Unauthorized change' },
        {
          id: '99999999-9999-4999-8999-999999999999',
          role: UserRole.HOTEL_OWNER,
        },
      ),
    ).rejects.toBeInstanceOf(AuthorizationDeniedException);
    expect(repository.save.mock.calls).toHaveLength(0);
  });
});
