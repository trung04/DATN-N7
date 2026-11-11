import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../authorization/decorators/public.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import {
  HotelImagesService,
  HOTEL_IMAGE_MAX_BYTES,
} from '../services/hotel-images.service';
import type { UploadedHotelImage } from '../services/hotel-images.service';
import { HotelImageManagementGuard } from '../guards/hotel-image-management.guard';
import { HotelImageResponse } from '../dtos/responses/hotel-image.response';
import { toHotelImageResponse } from '../mappers/hotel-image.mapper';

@ApiTags('Hotel images')
@ApiCookieAuth('login_access')
@Roles(UserRole.HOTEL_OWNER, UserRole.ADMIN)
@Controller({ path: 'hotels', version: '1' })
export class HotelImagesController {
  constructor(private readonly images: HotelImagesService) {}

  @Post(':hotelId/images')
  @UseGuards(HotelImageManagementGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: HOTEL_IMAGE_MAX_BYTES,
        files: 1,
        fields: 0,
        parts: 1,
      },
    }),
  )
  @ApiOperation({
    summary:
      'Upload a hotel image through the backend (JPEG/PNG/WebP, max 5 MiB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, type: HotelImageResponse })
  @ApiResponse({
    status: 400,
    description: 'Missing, malformed or unsupported image',
  })
  @ApiResponse({ status: 413, description: 'File exceeds 5 MiB' })
  @ApiResponse({ status: 503, description: 'Image storage unavailable' })
  async upload(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @CurrentUser() user: UserEntity,
    @UploadedFile() file: UploadedHotelImage | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = toHotelImageResponse(
      await this.images.upload(hotelId, file, user),
    );
    response.setHeader('Location', image.url);
    return image;
  }

  @Get(':hotelId/images/:imageId/file')
  @Public()
  @ApiOperation({ summary: 'Read an image of an active hotel' })
  async read(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Param('imageId', new ParseUUIDPipe({ version: '4' })) imageId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.file(await this.images.read(hotelId, imageId), response);
  }

  @Get('mine/:hotelId/images/:imageId/file')
  @ApiOperation({ summary: 'Preview an image as its hotel owner or an admin' })
  async preview(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Param('imageId', new ParseUUIDPipe({ version: '4' })) imageId: string,
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.file(await this.images.read(hotelId, imageId, user), response);
  }

  @Delete(':hotelId/images/:imageId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a hotel image and its stored object' })
  async delete(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Param('imageId', new ParseUUIDPipe({ version: '4' })) imageId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.images.delete(hotelId, imageId, user);
  }
  private file(
    result: Awaited<ReturnType<HotelImagesService['read']>>,
    response: Response,
  ) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(result.data, {
      type: result.image.contentType,
      length: result.data.length,
      disposition: `inline; filename="${result.image.id}.webp"`,
    });
  }
}
