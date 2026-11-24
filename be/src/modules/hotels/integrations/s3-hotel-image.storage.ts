import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { BucketLocationConstraint } from '@aws-sdk/client-s3';
import type { HotelImageStorage } from '../interfaces/hotel-image-storage.interface';
import {
  HotelImageStorageException,
  HotelImageNotFoundException,
} from '../exceptions/hotel-image.exceptions';

@Injectable()
export class S3HotelImageStorage implements HotelImageStorage, OnModuleDestroy {
  private readonly client?: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private ready?: Promise<void>;
  constructor(config: ConfigService) {
    this.bucket = config.get<string>('S3_HOTEL_IMAGES_BUCKET', 'hotel-images');
    this.region = config.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = config.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = config.get<string>('S3_SECRET_KEY');
    if (accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        endpoint: config.get<string>('S3_ENDPOINT', 'http://localhost:9002'),
        region: this.region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
        maxAttempts: 2,
        requestHandler: { connectionTimeout: 3000, requestTimeout: 15000 },
      });
    }
  }
  onModuleDestroy() {
    this.client?.destroy();
  }
  private async ensureBucket(): Promise<void> {
    const client = this.client;
    if (!client) throw new HotelImageStorageException();
    if (!this.ready) {
      this.ready = (async () => {
        try {
          await client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        } catch (error) {
          if (
            (error as { $metadata?: { httpStatusCode?: number } }).$metadata
              ?.httpStatusCode !== 404
          )
            throw error;
          try {
            await client.send(
              new CreateBucketCommand({
                Bucket: this.bucket,
                ...(this.region !== 'us-east-1'
                  ? {
                      CreateBucketConfiguration: {
                        LocationConstraint: this
                          .region as BucketLocationConstraint,
                      },
                    }
                  : {}),
              }),
            );
          } catch (createError) {
            if ((createError as Error).name !== 'BucketAlreadyOwnedByYou')
              throw createError;
          }
        }
      })().catch(() => {
        this.ready = undefined;
        throw new HotelImageStorageException();
      });
    }
    await this.ready;
  }
  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.ensureBucket();
    try {
      await this.client!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
        }),
      );
    } catch {
      this.ready = undefined;
      throw new HotelImageStorageException();
    }
  }
  async get(key: string): Promise<Buffer> {
    if (!this.client) throw new HotelImageStorageException();
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!object.Body) throw new Error('Empty storage response');
      return Buffer.from(await object.Body.transformToByteArray());
    } catch (error) {
      if ((error as Error).name === 'NoSuchKey')
        throw new HotelImageNotFoundException();
      throw new HotelImageStorageException();
    }
  }
  async delete(key: string): Promise<void> {
    if (!this.client) throw new HotelImageStorageException();
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      throw new HotelImageStorageException();
    }
  }
}
