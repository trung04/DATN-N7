import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../authorization/decorators/public.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import {
  LODGING_IMAGE_MAX_BYTES,
  type UploadedLodgingImage,
} from '../../media/normalize-lodging-image';
import { RoomImageManagementGuard } from '../guards/room-image-management.guard';
import { toRoomImageResponse } from '../mappers/room-image.mapper';
import {
  RoomImagesService,
  type RoomImageReadResult,
} from '../services/room-images.service';

@ApiTags('Room images')
@ApiCookieAuth('login_access')
@Roles(UserRole.HOTEL_OWNER, UserRole.ADMIN)
@Controller({ path: 'rooms', version: '1' })
export class RoomImagesController {
  constructor(private readonly images: RoomImagesService) {}
  @Get(':roomId/images')
  @Public()
  async list(
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
  ) {
    return (await this.images.list(roomId)).map(toRoomImageResponse);
  }
  @Get('mine/:roomId/images')
  async managedList(
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return (await this.images.list(roomId, user)).map(toRoomImageResponse);
  }
  @Post(':roomId/images')
  @UseGuards(RoomImageManagementGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: LODGING_IMAGE_MAX_BYTES,
        files: 1,
        fields: 0,
        parts: 1,
      },
    }),
  )
  async upload(
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
    @CurrentUser() user: UserEntity,
    @UploadedFile() file: UploadedLodgingImage | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = toRoomImageResponse(
      await this.images.upload(roomId, file, user),
    );
    response.setHeader('Location', image.url);
    return image;
  }
  @Patch(':roomId/images/:imageId/primary')
  async primary(
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
    @Param('imageId', new ParseUUIDPipe({ version: '4' })) imageId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return toRoomImageResponse(
      await this.images.makePrimary(roomId, imageId, user),
    );
  }
  @Delete(':roomId/images/:imageId')
  @HttpCode(204)
  async delete(
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
    @Param('imageId', new ParseUUIDPipe({ version: '4' })) imageId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.images.delete(roomId, imageId, user);
  }
  @Get(':roomId/images/:imageId/file')
  @Public()
  async read(
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
    @Param('imageId', new ParseUUIDPipe({ version: '4' })) imageId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.file(await this.images.read(roomId, imageId), response);
  }
  @Get('mine/:roomId/images/:imageId/file')
  async preview(
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
    @Param('imageId', new ParseUUIDPipe({ version: '4' })) imageId: string,
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.file(await this.images.read(roomId, imageId, user), response);
  }
  private file(result: RoomImageReadResult, response: Response) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    if (result.kind === 'fallback') {
      response.redirect(302, result.fallbackUrl);
      return;
    }
    return new StreamableFile(result.data, { type: result.contentType });
  }
}
