import { HotelOwnersService } from '../../hotel-owners/services/hotel-owners.service';
import { PlacesService } from '../../places/services/places.service';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/entities/user.entity';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { ListHotelsRequest } from '../dtos/requests/list-hotels.request';
import { HotelReviewCommand } from '../dtos/requests/review-hotel.request';
import {
  HotelDocumentEntity,
  HotelDocumentType,
} from '../entities/hotel-document.entity';
import { HotelReviewAction } from '../entities/hotel-review-history.entity';
import { HotelImageEntity } from '../entities/hotel-image.entity';
import { HotelEntity, HotelStatus } from '../entities/hotel.entity';
import {
  HotelDocumentLockedException,
  HotelLegalInformationLockedException,
  HotelNotActiveException,
  HotelNotFoundException,
  HotelSubmissionInvalidException,
} from '../exceptions/hotel.exceptions';
import type { HotelRepository } from '../interfaces/hotel.repository.interface';
import { HotelsService } from './hotels.service';

const hotelId = '11111111-1111-4111-8111-111111111111';
const ownerUserId = '22222222-2222-4222-8222-222222222222';
const reviewerUserId = '33333333-3333-4333-8333-333333333333';
const ownerActor = { id: ownerUserId, role: UserRole.HOTEL_OWNER };
const adminActor = { id: reviewerUserId, role: UserRole.ADMIN };

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
      findIdsByOwner: jest.fn(),
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

  it('stores a confirmed hotel position and supports zero coordinates', async () => {
    repository.create.mockResolvedValue(hotel());
    await service.create(ownerUserId, {
      name: 'Hotel', legalName: 'Hotel', taxCode: 'TAX', address: 'Address',
      phoneNumber: '0912345678', email: 'hotel@example.com', checkInTime: '14:00', checkOutTime: '12:00',
      latitude: 0, longitude: 0,
    });
    expect(repository.create.mock.calls[0]).toEqual([expect.objectContaining({ latitude: 0, longitude: 0 })]);
  });

  it('updates and clears hotel coordinates without changing its linked place', async () => {
    const existing = hotel({ status: HotelStatus.ACTIVE, placeId: hotelId });
    repository.findById.mockResolvedValue(existing);
    repository.save.mockImplementation(async (value) => value);
    await service.update(hotelId, { latitude: 16.06, longitude: 108.24 }, ownerActor);
    expect(existing).toMatchObject({ latitude: 16.06, longitude: 108.24, placeId: hotelId });
    await service.update(hotelId, { latitude: null, longitude: null }, ownerActor);
    expect(existing).toMatchObject({ latitude: null, longitude: null, placeId: hotelId });
  });

  it.each([
    { latitude: 16 }, { longitude: 108 }, { latitude: null, longitude: 108 },
    { latitude: 91, longitude: 108 }, { latitude: 16, longitude: -181 },
    { latitude: Number.NaN, longitude: 108 }, { latitude: 16, longitude: Infinity },
  ])('rejects invalid or incomplete coordinate updates: %j', async (input) => {
    repository.findById.mockResolvedValue(hotel());
    await expect(service.update(hotelId, input, ownerActor)).rejects.toMatchObject({ status: 400 });
    expect(repository.save.mock.calls).toHaveLength(0);
  });

  it('does not let another owner change hotel coordinates', async () => {
    repository.findById.mockResolvedValue(hotel());
    await expect(service.update(hotelId, { latitude: 16, longitude: 108 }, { id: reviewerUserId, role: UserRole.HOTEL_OWNER })).rejects.toBeInstanceOf(AuthorizationDeniedException);
    expect(repository.save.mock.calls).toHaveLength(0);
  });

  it('keeps coordinates locked while the hotel is pending approval', async () => {
    repository.findById.mockResolvedValue(hotel({ status: HotelStatus.PENDING_APPROVAL }));
    await expect(service.update(hotelId, { latitude: 16, longitude: 108 }, ownerActor)).rejects.toMatchObject({ code: 'HOTEL_UPDATE_LOCKED' });
    expect(repository.save.mock.calls).toHaveLength(0);
  });

  it('allows the owner to read a pending hotel and unlocks operations after approval', async () => {
    const pending = hotel({ status: HotelStatus.PENDING_APPROVAL });
    repository.findById.mockResolvedValue(pending);
    await expect(service.assertManagedBy(hotelId, ownerActor)).resolves.toBe(pending);
    await expect(service.assertManagedBy(hotelId, ownerActor, { requiresActiveHotel: true }))
      .rejects.toMatchObject({ code: 'HOTEL_UPDATE_LOCKED' });
    await expect(service.assertManagedBy(hotelId, adminActor, { requiresActiveHotel: true }))
      .resolves.toBe(pending);

    const active = hotel({ status: HotelStatus.ACTIVE });
    repository.findById.mockResolvedValue(active);
    await expect(service.assertManagedBy(hotelId, ownerActor, { requiresActiveHotel: true }))
      .resolves.toBe(active);
    await expect(service.assertManagedBy(hotelId, { ...ownerActor, id: reviewerUserId }, { requiresActiveHotel: true }))
      .rejects.toBeInstanceOf(AuthorizationDeniedException);
  });

  it.each([HotelStatus.DRAFT, HotelStatus.REJECTED, HotelStatus.INACTIVE, HotelStatus.SUSPENDED])(
    'disallows owner operations while the hotel is %s',
    async (status) => {
      repository.findById.mockResolvedValue(hotel({ status }));
      await expect(service.assertManagedBy(hotelId, ownerActor, { requiresActiveHotel: true }))
        .rejects.toBeInstanceOf(HotelNotActiveException);
    },
  );

  it('submits a hotel with a photo and a valid license even if another license expired', async () => {
    const existing = hotel({
      documents: [document({ expiresAt: '2020-01-01' }), document({ expiresAt: null })],
      images: [new HotelImageEntity()],
    });
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
      expect.any(Function),
    ]);
  });

  it.each([
    hotel({ images: [new HotelImageEntity()] }),
    hotel({ images: [new HotelImageEntity()], documents: [document({ fileUrl: '' })] }),
    hotel({ images: [new HotelImageEntity()], documents: [document({ expiresAt: '2020-01-01' })] }),
    hotel({ images: [], documents: [document()] }),
  ])('does not submit an incomplete hotel profile', async (incomplete) => {
    repository.findById.mockResolvedValue(incomplete);
    await expect(service.submit(hotelId, ownerActor)).rejects.toBeInstanceOf(
      HotelSubmissionInvalidException,
    );
    expect(repository.saveWithReview).not.toHaveBeenCalled();
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

  it('excludes drafts from the review list and keeps them in the owner list', async () => {
    const query = Object.assign(new ListHotelsRequest(), {
      page: 2,
      limit: 6,
      search: 'Sun',
      status: HotelStatus.DRAFT,
    });
    repository.findPage.mockResolvedValue({ items: [], total: 0 });

    await service.findReviewPage(query);
    await service.findOwnedPage(query, ownerUserId);

    expect(repository.findPage.mock.calls).toEqual([
      [
        expect.objectContaining({
          page: 2,
          limit: 6,
          search: 'Sun',
          status: HotelStatus.DRAFT,
          excludedStatus: HotelStatus.DRAFT,
        }),
      ],
      [
        expect.objectContaining({
          ownerUserId,
          status: HotelStatus.DRAFT,
          excludedStatus: undefined,
        }),
      ],
    ]);
  });

  it('keeps a draft accessible to its owner and out of admin review and management', async () => {
    const draft = hotel();
    repository.findById.mockResolvedValue(draft);

    await expect(service.assertManagedBy(hotelId, ownerActor)).resolves.toBe(
      draft,
    );
    await expect(
      service.assertManagedBy(hotelId, adminActor),
    ).rejects.toBeInstanceOf(HotelNotFoundException);
    await expect(service.findForReview(hotelId)).rejects.toBeInstanceOf(
      HotelNotFoundException,
    );
    await expect(service.findReviewHistory(hotelId)).rejects.toBeInstanceOf(
      HotelNotFoundException,
    );
    await expect(
      service.review(hotelId, reviewerUserId, {
        action: HotelReviewCommand.APPROVE,
      }),
    ).rejects.toBeInstanceOf(HotelNotFoundException);
    expect(repository.findReviewHistory.mock.calls).toHaveLength(0);
    expect(repository.saveWithReview.mock.calls).toHaveLength(0);
  });

  it('keeps active hotels without a submission date available for review', async () => {
    const active = hotel({ status: HotelStatus.ACTIVE });
    repository.findById.mockResolvedValue(active);

    await expect(service.findForReview(hotelId)).resolves.toBe(active);
    await expect(service.assertManagedBy(hotelId, adminActor)).resolves.toBe(
      active,
    );
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
