import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Res, StreamableFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import { HotelDocumentManagementGuard } from '../guards/hotel-document-management.guard';
import { UploadHotelDocumentRequest } from '../dtos/requests/upload-hotel-document.request';
import { HotelDocumentsService } from '../services/hotel-documents.service';
import type { UploadedLodgingImage } from '../../media/normalize-lodging-image';
import { HotelMapper } from '../mappers/hotel.mapper';

const upload = () => FilesInterceptor('files', 3, { limits: { fileSize: 5 * 1024 * 1024, files: 3, fields: 5, parts: 8 } });
const multipart = {
  schema: { type: 'object' as const, required: ['documentType', 'documentNumber'], properties: {
    documentType: { type: 'string' as const }, documentNumber: { type: 'string' as const }, issuedAt: { type: 'string' as const, format: 'date' }, expiresAt: { type: 'string' as const, format: 'date' },
    files: { type: 'array' as const, maxItems: 3, items: { type: 'string' as const, format: 'binary' } },
  } },
};

@ApiTags('Hotel documents')
@ApiCookieAuth('login_access')
@Roles(UserRole.HOTEL_OWNER, UserRole.ADMIN)
@Controller({ path: 'hotels/:hotelId/documents', version: '1' })
export class HotelDocumentsController {
  constructor(private readonly documents: HotelDocumentsService) {}

  @Post('upload')
  @UseGuards(HotelDocumentManagementGuard)
  @UseInterceptors(upload())
  @ApiOperation({ summary: 'Create a legal document with 1–3 images, each at most 5 MiB' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipart)
  async create(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @CurrentUser() user: UserEntity,
    @Body() input: UploadHotelDocumentRequest,
    @UploadedFiles() files: UploadedLodgingImage[] | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = HotelMapper.toDocumentResponse(await this.documents.save(hotelId, input, files, user));
    response.setHeader('Location', document.fileUrl);
    return document;
  }

  @Patch(':documentId/upload')
  @UseGuards(HotelDocumentManagementGuard)
  @UseInterceptors(upload())
  @ApiOperation({ summary: 'Edit a document; optionally replace all its images with 1–3 new images' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipart)
  async update(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @CurrentUser() user: UserEntity,
    @Body() input: UploadHotelDocumentRequest,
    @UploadedFiles() files: UploadedLodgingImage[] | undefined,
  ) {
    return HotelMapper.toDocumentResponse(await this.documents.save(hotelId, input, files, user, documentId));
  }

  @Get(':documentId/files/:fileId')
  @ApiOperation({ summary: 'Read a private legal document image as its owner or an administrator' })
  async read(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Param('fileId', new ParseUUIDPipe({ version: '4' })) fileId: string,
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.documents.read(hotelId, documentId, fileId, user);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', 'inline; filename="hotel-document.webp"');
    return new StreamableFile(file.data);
  }
}
