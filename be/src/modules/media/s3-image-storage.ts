import type { OnModuleDestroy } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { BucketLocationConstraint } from '@aws-sdk/client-s3';
import type { ImageStorage } from './image-storage.interface';

export abstract class S3ImageStorage implements ImageStorage, OnModuleDestroy {
  protected abstract unavailable(): Error;
  protected abstract notFound(): Error;
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
    if (!client) throw this.unavailable();
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
        throw this.unavailable();
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
      throw this.unavailable();
    }
  }
  async get(key: string): Promise<Buffer> {
    if (!this.client) throw this.unavailable();
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!object.Body) throw new Error('Empty storage response');
      return Buffer.from(await object.Body.transformToByteArray());
    } catch (error) {
      if ((error as Error).name === 'NoSuchKey')
        throw this.notFound();
      throw this.unavailable();
    }
  }
  async delete(key: string): Promise<void> {
    if (!this.client) throw this.unavailable();
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      throw this.unavailable();
    }
  }
}
