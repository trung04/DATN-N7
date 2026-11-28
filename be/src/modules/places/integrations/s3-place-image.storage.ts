import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3ImageStorage } from '../../media/s3-image-storage';
import {
  PlaceImageNotFoundException,
  PlaceImageStorageException,
} from '../exceptions/place-image.exceptions';

export const PLACE_IMAGE_STORAGE = Symbol('PLACE_IMAGE_STORAGE');

@Injectable()
export class S3PlaceImageStorage extends S3ImageStorage {
  constructor(config: ConfigService) {
    super(config);
  }

  protected unavailable(): Error {
    return new PlaceImageStorageException();
  }

  protected notFound(): Error {
    return new PlaceImageNotFoundException();
  }
}
