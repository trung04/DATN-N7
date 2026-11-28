import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3ImageStorage } from '../../media/s3-image-storage';
import {
  HotelImageNotFoundException,
  HotelImageStorageException,
} from '../exceptions/hotel-image.exceptions';

@Injectable()
export class S3HotelImageStorage extends S3ImageStorage {
  constructor(config: ConfigService) {
    super(config);
  }

  protected unavailable(): Error {
    return new HotelImageStorageException();
  }

  protected notFound(): Error {
    return new HotelImageNotFoundException();
  }
}
