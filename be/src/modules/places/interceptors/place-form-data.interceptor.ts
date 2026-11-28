import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { LODGING_IMAGE_MAX_BYTES, type UploadedLodgingImage } from '../../media/normalize-lodging-image';

export const PlaceImageUploadInterceptor = FileInterceptor('file', {
  // Read one extra byte to enforce the inclusive file size limit below.
  limits: { fileSize: LODGING_IMAGE_MAX_BYTES + 1, files: 1, fields: 1, fieldSize: 128 * 1024 },
});

@Injectable()
export class PlaceFormDataInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request & { file?: UploadedLodgingImage }>();
    if (request.is('multipart/form-data')) {
      const { data } = request.body as { data?: unknown };
      if (typeof data !== 'string' || !request.file) {
        throw new BadRequestException('Provide the place data and an image file.');
      }
      if (request.file.buffer.length > LODGING_IMAGE_MAX_BYTES) {
        throw new PayloadTooLargeException('The place image must be at most 5 MiB.');
      }

      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        throw new BadRequestException('Place data must be a valid JSON object.');
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new BadRequestException('Place data must be a valid JSON object.');
      }
      request.body = payload;
    }
    return next.handle();
  }
}
