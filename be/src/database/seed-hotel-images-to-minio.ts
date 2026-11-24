import { randomUUID } from 'node:crypto';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import dataSource from './typeorm.datasource';

interface DemoPhoto {
  relationId: string;
  parentId: string;
  imageId: string;
  photoId: string;
  objectKey: string;
  fallbackUrl: string;
  sourceUrl: string;
  altText: string;
  relationTable: 'hotel_images' | 'room_images';
  parentColumn: 'hotel_id' | 'room_id';
}

interface LodgingPhotoRow {
  relationId: string;
  parentId: string;
  imageId: string;
  imageOrder: number;
  taxCode: string;
  roomNumber?: string;
}

interface AssetMetadata {
  byteSize: number;
  width: number;
  height: number;
}

const hotelPhotoIds = [
  'photo-1566073771259-6a8506099945',
  'photo-1571896349842-33c89424de2d',
  'photo-1564501049412-61c2a3083791',
  'photo-1542314831-068cd1dbfeeb',
  'photo-1520250497591-112f2f40a3f4',
  'photo-1568084680786-a84f91d1153c',
  'photo-1582719508461-905c673771fd',
  'photo-1551882547-ff40c63fe5fa',
  'photo-1660676693968-5b2f500e56ad',
  'photo-1563911302283-d2bc129e7570',
  'photo-1540541338287-41700207dee6',
  'photo-1549294413-26f195200c16',
];

const roomPhotoIds = [
  'photo-1611892440504-42a792e24d32',
  'photo-1590490360182-c33d57733427',
  'photo-1566665797739-1674de7a421a',
  'photo-1582719478250-c89cae4dc85b',
  'photo-1618773928121-c32242e63f39',
  'photo-1631049307264-da0ec9d70304',
  'photo-1652161854125-1f5289c13eac',
  'photo-1718985344687-95bed07d9a1d',
  'photo-1631048730653-fe02e0784236',
  'photo-1578898886225-c7c894047899',
  'photo-1713762523087-41019a875741',
  'photo-1578683010236-d716f9a3f461',
];

function unsplashUrl(photoId: string, width: number): string {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

function hotelSequence(taxCode: string): number {
  const match = /^DEMO-HOTEL-(\d{4})$/.exec(taxCode);
  if (!match) throw new Error(`Unexpected demo hotel code ${taxCode}.`);
  return Number(match[1]);
}

function toDemoPhotos(
  rows: LodgingPhotoRow[],
  relationTable: DemoPhoto['relationTable'],
): DemoPhoto[] {
  return rows.map((row) => {
    const sequence = hotelSequence(row.taxCode);
    const photoId =
      relationTable === 'hotel_images'
        ? hotelPhotoIds[(sequence * 3 + row.imageOrder - 1) % hotelPhotoIds.length]!
        : roomPhotoIds[
            (sequence * 7 + Number(row.roomNumber ?? 0)) % roomPhotoIds.length
          ]!;
    const isHotel = relationTable === 'hotel_images';
    const objectKey = `demo-lodging/${isHotel ? 'hotels' : 'rooms'}/${photoId}.webp`;
    return {
      relationId: row.relationId,
      parentId: row.parentId,
      imageId: row.imageId,
      photoId,
      objectKey,
      fallbackUrl: unsplashUrl(photoId, 1800),
      sourceUrl: `https://images.unsplash.com/${photoId}`,
      altText: isHotel
        ? 'Ảnh minh họa khách sạn'
        : 'Ảnh minh họa phòng nghỉ khách sạn',
      relationTable,
      parentColumn: isHotel ? 'hotel_id' : 'room_id',
    };
  });
}

async function getDemoPhotos(): Promise<DemoPhoto[]> {
  const hotelRows = (await dataSource.query(
    `SELECT hi.id AS "relationId", hi.hotel_id AS "parentId",
            hi.image_id AS "imageId", hi.image_order AS "imageOrder",
            h.tax_code AS "taxCode"
       FROM hotel_images hi
       JOIN hotels h ON h.id = hi.hotel_id
      WHERE h.tax_code LIKE 'DEMO-HOTEL-%'
        AND hi.deleted_at IS NULL
      ORDER BY h.tax_code, hi.image_order`,
  )) as LodgingPhotoRow[];
  const roomRows = (await dataSource.query(
    `SELECT ri.id AS "relationId", ri.room_id AS "parentId",
            ri.image_id AS "imageId", ri.image_order AS "imageOrder",
            h.tax_code AS "taxCode", r.room_number AS "roomNumber"
       FROM room_images ri
       JOIN rooms r ON r.id = ri.room_id
       JOIN hotels h ON h.id = r.hotel_id
      WHERE h.tax_code LIKE 'DEMO-HOTEL-%'
        AND r.deleted_at IS NULL AND ri.deleted_at IS NULL
      ORDER BY h.tax_code, r.room_number, ri.image_order`,
  )) as LodgingPhotoRow[];

  if (!hotelRows.length || !roomRows.length)
    throw new Error('Run the demo lodging seed before importing hotel and room photos.');
  return [
    ...toDemoPhotos(hotelRows, 'hotel_images'),
    ...toDemoPhotos(roomRows, 'room_images'),
  ];
}

async function importDemoLodgingImages(): Promise<void> {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_HOTEL_IMAGES_BUCKET ?? 'hotel-images';
  if (!endpoint || !accessKeyId || !secretAccessKey)
    throw new Error('S3 configuration is required to import lodging images.');

  const client = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    await dataSource.initialize();
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode !== 404
      )
        throw error;
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }

    const photos = await getDemoPhotos();
    const assets = new Map<string, AssetMetadata>();
    const imageSourceCache = new Map<string, Buffer>();

    for (const photo of photos) {
      if (assets.has(photo.objectKey)) continue;
      let source = imageSourceCache.get(photo.photoId);
      if (!source) {
        const response = await fetch(photo.fallbackUrl, {
          signal: AbortSignal.timeout(20_000),
        });
        if (
          !response.ok ||
          new URL(response.url).origin !== 'https://images.unsplash.com' ||
          !response.headers.get('content-type')?.startsWith('image/')
        )
          throw new Error(`Could not download accommodation photo ${photo.photoId}.`);
        source = Buffer.from(await response.arrayBuffer());
        imageSourceCache.set(photo.photoId, source);
      }

      const normalized = await sharp(source, {
        limitInputPixels: 20_000_000,
        failOn: 'warning',
      })
        .rotate()
        .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: photo.objectKey,
          Body: normalized.data,
          ContentType: 'image/webp',
        }),
      );
      assets.set(photo.objectKey, {
        byteSize: normalized.info.size,
        width: normalized.info.width,
        height: normalized.info.height,
      });
    }

    await dataSource.transaction(async (manager) => {
      const imageIds = new Map<string, string>();
      const assetPhotos = new Map(photos.map((photo) => [photo.objectKey, photo]));
      for (const [objectKey, metadata] of assets) {
        const photo = assetPhotos.get(objectKey)!;
        const matching = (await manager.query(
          'SELECT id FROM images WHERE object_key = $1 AND deleted_at IS NULL',
          [objectKey],
        )) as Array<{ id: string }>;
        const imageId = matching[0]?.id ?? randomUUID();
        const values = [
          photo.fallbackUrl,
          metadata.byteSize,
          metadata.width,
          metadata.height,
          photo.altText,
          photo.sourceUrl,
          'Ảnh minh họa không gian lưu trú từ Unsplash.',
        ];
        if (matching.length) {
          await manager.query(
            `UPDATE images
                SET storage_provider = 'MINIO', image_url = NULL,
                    content_type = 'image/webp', fallback_url = $1,
                    byte_size = $2, width = $3, height = $4, alt_text = $5,
                    source_provider = 'UNSPLASH', source_url = $6,
                    attribution_text = $7, updated_at = now()
              WHERE id = $8 AND deleted_at IS NULL`,
            [...values, imageId],
          );
        } else {
          await manager.query(
            `INSERT INTO images (
               id, storage_provider, object_key, image_url, content_type,
               fallback_url, byte_size, width, height, alt_text,
               source_provider, source_url, attribution_text, created_at, updated_at
             ) VALUES (
               $1, 'MINIO', $2, NULL, 'image/webp', $3, $4, $5, $6, $7,
               'UNSPLASH', $8, $9, now(), now()
             )`,
            [imageId, objectKey, ...values],
          );
        }
        imageIds.set(objectKey, imageId);
      }

      for (const photo of photos) {
        const updated = (await manager.query(
          `UPDATE ${photo.relationTable}
              SET image_id = $2, updated_at = now()
            WHERE id = $1 AND ${photo.parentColumn} = $3 AND image_id = $4
              AND deleted_at IS NULL
            RETURNING id`,
          [photo.relationId, imageIds.get(photo.objectKey), photo.parentId, photo.imageId],
        )) as Array<{ id: string }>;
        if (!updated.length)
          throw new Error(`Demo image relation ${photo.relationId} changed during import.`);
      }
    });

    console.log(
      `Imported ${photos.length} hotel and room photo links from ${assets.size} Unsplash stock photos into MinIO.`,
    );
  } finally {
    client.destroy();
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void importDemoLodgingImages().catch((error: unknown) => {
  console.error('Failed to import demo lodging images into MinIO.', error);
  process.exitCode = 1;
});
