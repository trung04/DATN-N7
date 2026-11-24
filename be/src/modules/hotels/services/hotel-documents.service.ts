import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import { normalizeLodgingImage, type UploadedLodgingImage } from '../../media/normalize-lodging-image';
import { HotelDocumentEntity, type HotelDocumentFile } from '../entities/hotel-document.entity';
import { HotelEntity, HotelStatus } from '../entities/hotel.entity';
import { HotelDocumentLockedException, HotelDocumentNotFoundException, HotelNotFoundException, HotelSubmissionInvalidException } from '../exceptions/hotel.exceptions';
import { InvalidHotelDocumentImagesException } from '../exceptions/hotel-document-upload.exceptions';
import { HOTEL_DOCUMENT_REPOSITORY, type HotelDocumentRepository } from '../interfaces/hotel-document.repository.interface';
import { HOTEL_IMAGE_STORAGE, type HotelImageStorage } from '../interfaces/hotel-image-storage.interface';
import type { UploadHotelDocumentRequest } from '../dtos/requests/upload-hotel-document.request';
import { HotelsService } from './hotels.service';

@Injectable()
export class HotelDocumentsService {
  private readonly logger = new Logger(HotelDocumentsService.name);
  constructor(
    private readonly hotels: HotelsService,
    @Inject(HOTEL_DOCUMENT_REPOSITORY) private readonly repository: HotelDocumentRepository,
    @Inject(HOTEL_IMAGE_STORAGE) private readonly storage: HotelImageStorage,
  ) {}

  async assertCanEdit(hotelId: string, actor: AuthorizationActor) {
    this.assertEditable(await this.hotels.assertManagedBy(hotelId, actor), actor);
  }

  private assertEditable(hotel: HotelEntity | null, actor: AuthorizationActor) {
    if (!hotel) throw new HotelNotFoundException('unknown');
    if (![UserRole.ADMIN, UserRole.HOTEL_OWNER].includes(actor.role) || (actor.role !== UserRole.ADMIN && hotel.ownerUserId !== actor.id)) throw new AuthorizationDeniedException();
    if (![HotelStatus.DRAFT, HotelStatus.REJECTED].includes(hotel.status)) throw new HotelDocumentLockedException();
  }

  async save(hotelId: string, input: UploadHotelDocumentRequest, uploads: UploadedLodgingImage[] | undefined, actor: AuthorizationActor, documentId?: string) {
    await this.assertCanEdit(hotelId, actor);
    if (input.issuedAt && input.expiresAt && input.issuedAt > input.expiresAt) throw new HotelSubmissionInvalidException('Ngày hết hạn không được trước ngày cấp.');
    const files = uploads ?? [];
    if ((!documentId && files.length === 0) || files.length > 3) throw new InvalidHotelDocumentImagesException();
    // Validate the entire batch before any object is stored.
    const normalized = [];
    try { for (const file of files) normalized.push(await normalizeLodgingImage(file)); }
    catch { throw new InvalidHotelDocumentImagesException(); }
    const id = documentId ?? randomUUID();
    const added: HotelDocumentFile[] = [];
    let saved: { document: HotelDocumentEntity; obsolete: HotelDocumentFile[] };
    try {
      for (const image of normalized) {
        const fileId = randomUUID();
        const file = { id: fileId, objectKey: `hotel-documents/${hotelId}/${id}/${fileId}.webp`, contentType: 'image/webp', byteSize: image.size, width: image.width, height: image.height };
        // Include even a partially successful PUT in compensation cleanup.
        added.push(file);
        await this.storage.put(file.objectKey, image.data, file.contentType);
      }
      saved = await this.repository.transaction(hotelId, async transaction => {
        this.assertEditable(transaction.hotel, actor);
        const document = documentId ? await transaction.find(id) : Object.assign(new HotelDocumentEntity(), { id, hotelId, files: [] });
        if (!document) throw new HotelDocumentNotFoundException(id);
        const obsolete = added.length ? document.files ?? [] : [];
        document.documentType = input.documentType;
        document.documentNumber = input.documentNumber.trim();
        document.issuedAt = input.issuedAt || null;
        document.expiresAt = input.expiresAt || null;
        if (added.length) {
          document.files = added;
          document.fileUrl = this.fileUrl(hotelId, id, added[0].id);
        }
        return { document: await transaction.save(document), obsolete };
      });
    } catch (error) { await this.cleanup(added); throw error; }
    await this.cleanup(saved.obsolete);
    return saved.document;
  }

  async read(hotelId: string, documentId: string, fileId: string, actor: AuthorizationActor) {
    if (![UserRole.ADMIN, UserRole.HOTEL_OWNER].includes(actor.role)) throw new AuthorizationDeniedException();
    await this.hotels.assertManagedBy(hotelId, actor);
    const document = await this.repository.find(hotelId, documentId);
    const file = document?.files?.find(item => item.id === fileId);
    if (!file) throw new HotelDocumentNotFoundException(documentId);
    return { data: await this.storage.get(file.objectKey), contentType: file.contentType };
  }

  async remove(hotelId: string, documentId: string, actor: AuthorizationActor) {
    await this.assertCanEdit(hotelId, actor);
    const files = await this.repository.transaction(hotelId, async transaction => {
      this.assertEditable(transaction.hotel, actor);
      const document = await transaction.find(documentId);
      if (!document) throw new HotelDocumentNotFoundException(documentId);
      const files = document.files ?? [];
      await transaction.delete(document);
      return files;
    });
    await this.cleanup(files);
  }

  private fileUrl(hotelId: string, documentId: string, fileId: string) {
    return `/api/v1/hotels/${hotelId}/documents/${documentId}/files/${fileId}`;
  }

  private async cleanup(files: HotelDocumentFile[]) {
    for (const file of files) {
      try { await this.storage.delete(file.objectKey); }
      catch { this.logger.error('Failed to remove an unlinked hotel document image'); }
    }
  }
}
