import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { HotelDocumentsController } from '../src/modules/hotels/controllers/hotel-documents.controller';
import { HotelsController } from '../src/modules/hotels/controllers/hotels.controller';
import { HotelDocumentsService } from '../src/modules/hotels/services/hotel-documents.service';
import { HotelDocumentManagementGuard } from '../src/modules/hotels/guards/hotel-document-management.guard';
import { HotelsService } from '../src/modules/hotels/services/hotels.service';
import { HOTEL_DOCUMENT_REPOSITORY, type HotelDocumentTransaction } from '../src/modules/hotels/interfaces/hotel-document.repository.interface';
import { HOTEL_IMAGE_STORAGE } from '../src/modules/hotels/interfaces/hotel-image-storage.interface';
import { HotelDocumentEntity } from '../src/modules/hotels/entities/hotel-document.entity';
import { HotelEntity, HotelStatus } from '../src/modules/hotels/entities/hotel.entity';
import { AuthorizationDeniedException } from '../src/modules/authorization/exceptions/authorization.exceptions';
import { AccessSessionGuard } from '../src/modules/auth/guards/access-session.guard';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { RolesGuard } from '../src/modules/authorization/guards/roles.guard';
import { UserRole } from '../src/modules/users/entities/user.entity';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';

const hotelId = '11111111-1111-4111-8111-111111111111';
describe('Private legal document uploads (HTTP)', () => {
  let app: INestApplication<App>;
  let png: Buffer;
  const hotel = Object.assign(new HotelEntity(), { id: hotelId, ownerUserId: 'owner', status: HotelStatus.DRAFT });
  const records = new Map<string, HotelDocumentEntity>();
  const objects = new Map<string, Buffer>();
  let failPutAt = 0;
  let putCount = 0;
  let failDatabase = false;
  let lockDuringUpload = false;
  beforeAll(async () => {
    png = await sharp({ create: { width: 32, height: 32, channels: 3, background: 'white' } }).png().toBuffer();
    const module = await Test.createTestingModule({
      controllers: [HotelDocumentsController, HotelsController],
      providers: [HotelDocumentsService, HotelDocumentManagementGuard,
        { provide: HotelsService, useValue: { assertManagedBy: async (_id: string, actor: { id: string; role: UserRole }) => {
          if (actor.id !== 'owner' && actor.role !== UserRole.ADMIN) throw new AuthorizationDeniedException();
          return hotel;
        } } },
        { provide: HOTEL_DOCUMENT_REPOSITORY, useValue: {
          find: async (_hotel: string, id: string) => records.get(id) ?? null,
          transaction: async (_hotel: string, work: (tx: HotelDocumentTransaction) => Promise<unknown>) => {
            if (lockDuringUpload) hotel.status = HotelStatus.PENDING_APPROVAL;
            return work({ hotel,
              find: async id => { const row = records.get(id); return row ? Object.assign(new HotelDocumentEntity(), row) : null; },
              save: async document => {
                if (failDatabase) throw new Error('DB failure');
                document.createdAt ??= new Date(); document.updatedAt = new Date(); records.set(document.id, document); return document;
              },
              delete: async document => { records.delete(document.id); },
            });
          },
        } },
        { provide: HOTEL_IMAGE_STORAGE, useValue: {
          put: async (key: string, data: Buffer) => { if (++putCount === failPutAt) throw new Error('Storage unavailable'); objects.set(key, data); },
          get: async (key: string) => objects.get(key),
          delete: async (key: string) => { objects.delete(key); },
        } },
        { provide: AuthService, useValue: { authenticate: async (token: string) => ({ id: token, role: token === 'admin' ? UserRole.ADMIN : token === 'tourist' ? UserRole.TOURIST : UserRole.HOTEL_OWNER }) } },
        { provide: APP_GUARD, useClass: AccessSessionGuard }, { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication(); configureHttpApplication(app); app.useGlobalFilters(new ProblemDetailsFilter()); await app.init();
  });
  beforeEach(() => { records.clear(); objects.clear(); hotel.status = HotelStatus.DRAFT; failPutAt = 0; putCount = 0; failDatabase = false; lockDuringUpload = false; });
  afterAll(async () => app.close());
  const upload = (count = 3, actor = 'owner') => {
    const req = request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/documents/upload`).set('Cookie', `login_access=${actor}`).field('documentType', 'BUSINESS_LICENSE').field('documentNumber', 'LICENSE-1');
    for (let index = 0; index < count; index++) req.attach('files', png, { filename: `page-${index}.png`, contentType: 'image/png' });
    return req;
  };
  const edit = (id: string, number = 'LICENSE-EDIT') => request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/documents/${id}/upload`).set('Cookie', 'login_access=owner').field('documentType', 'BUSINESS_LICENSE').field('documentNumber', number);

  it('uploads three pages as one document, reads privately, edits metadata, replaces images and deletes', async () => {
    const created = await upload().expect(201);
    expect(created.body.files).toHaveLength(3); expect(records.size).toBe(1); expect(objects.size).toBe(3);
    expect(JSON.stringify(created.body)).not.toContain('objectKey');
    const file = created.body.files[0].url as string;
    for (const actor of ['owner', 'admin']) await request(app.getHttpServer()).get(file).set('Cookie', `login_access=${actor}`).expect(200).expect('Content-Type', /image\/webp/).expect('Cache-Control', 'private, no-store');
    await request(app.getHttpServer()).get(file).expect(401);
    await request(app.getHttpServer()).get(file).set('Cookie', 'login_access=other').expect(403);
    await request(app.getHttpServer()).get(file).set('Cookie', 'login_access=tourist').expect(403);
    const metadata = await edit(created.body.id).expect(200);
    expect(metadata.body.files).toEqual(created.body.files);
    const replacement = await edit(created.body.id).attach('files', png, { filename: 'replacement.png', contentType: 'image/png' }).expect(200);
    expect(replacement.body.files).toHaveLength(1); expect(objects.size).toBe(1);
    await request(app.getHttpServer()).get(file).set('Cookie', 'login_access=owner').expect(404);
    await request(app.getHttpServer()).delete(`/api/v1/hotels/${hotelId}/documents/${created.body.id}`).set('Cookie', 'login_access=owner').expect(204);
    expect(records.size).toBe(0); expect(objects.size).toBe(0);
  });
  it('rejects empty and oversized batches without persisting anything', async () => {
    await upload(0).expect(400); await upload(4).expect(400);
    expect(records.size).toBe(0); expect(objects.size).toBe(0);
  });
  it('rejects oversized files, fake images and an invalid second image before storing the first', async () => {
    await edit(randomUUID()).attach('files', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' }).expect(413);
    await edit(randomUUID()).attach('files', png, { filename: 'valid.png', contentType: 'image/png' }).attach('files', Buffer.from('fake'), { filename: 'bad.png', contentType: 'image/png' }).expect(400);
    expect(objects.size).toBe(0); expect(putCount).toBe(0);
  });
  it.each(['other', 'tourist'])('denies uploads by %s', async actor => { await upload(1, actor).expect(403); expect(putCount).toBe(0); });
  it.each([HotelStatus.PENDING_APPROVAL, HotelStatus.ACTIVE, HotelStatus.SUSPENDED])('locks mutation in state %s', async status => {
    hotel.status = status; await upload(1).expect(409); expect(putCount).toBe(0);
  });
  it('removes staged files when storage or database persistence fails', async () => {
    failPutAt = 2; await upload().expect(500); expect(objects.size).toBe(0); expect(records.size).toBe(0);
    failPutAt = 0; failDatabase = true; await upload().expect(500); expect(objects.size).toBe(0); expect(records.size).toBe(0);
  });
  it('rechecks approval status in the transaction and cleans up staged uploads', async () => {
    lockDuringUpload = true; await upload().expect(409); expect(objects.size).toBe(0); expect(records.size).toBe(0);
  });
  it('preserves existing images and metadata after a failed replacement', async () => {
    const created = await upload().expect(201);
    failDatabase = true;
    await edit(created.body.id).attach('files', png, { filename: 'new.png', contentType: 'image/png' }).expect(500);
    expect(objects.size).toBe(3); expect(records.get(created.body.id)?.documentNumber).toBe('LICENSE-1');
  });
  it('validates metadata before storage and checks missing document IDs', async () => {
    await edit(randomUUID()).field('issuedAt', '2026-11-19').field('expiresAt', '2025-01-01').expect(400);
    await edit(randomUUID()).expect(404);
    expect(putCount).toBe(0);
  });
});
