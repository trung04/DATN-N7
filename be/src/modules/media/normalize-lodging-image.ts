import sharp from 'sharp';

export const LODGING_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export interface UploadedLodgingImage {
  buffer: Buffer;
  mimetype: string;
}

export async function normalizeLodgingImage(file?: UploadedLodgingImage) {
  if (!file?.buffer?.length || file.buffer.length > LODGING_IMAGE_MAX_BYTES)
    throw new Error('Invalid image size');
  const image = sharp(file.buffer, {
    limitInputPixels: 20_000_000,
    failOn: 'warning',
  });
  const metadata = await image.metadata();
  const formats: Record<string, string> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  if (
    !metadata.format ||
    formats[metadata.format] !== file.mimetype ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error('Unsupported image');
  const result = await image
    .rotate()
    .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  if (result.info.size > LODGING_IMAGE_MAX_BYTES)
    throw new Error('Image too large');
  return { ...result.info, data: result.data };
}
