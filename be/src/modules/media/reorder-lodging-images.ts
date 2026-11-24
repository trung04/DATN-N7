import type { EntityManager } from 'typeorm';

export async function makeLodgingImagePrimary(
  manager: EntityManager,
  kind: 'hotel' | 'room',
  ownerId: string,
  imageId: string,
): Promise<boolean> {
  const table = kind === 'hotel' ? 'hotel_images' : 'room_images';
  const column = kind === 'hotel' ? 'hotel_id' : 'room_id';
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `${kind}-images:${ownerId}`,
  ]);
  const rows = (await manager.query(
    `SELECT id, image_order AS "imageOrder" FROM ${table} WHERE ${column}=$1 AND deleted_at IS NULL ORDER BY image_order, id FOR UPDATE`,
    [ownerId],
  )) as Array<{ id: string; imageOrder: number }>;
  if (!rows.some((row) => row.id === imageId)) return false;
  const offset = Math.max(...rows.map((row) => row.imageOrder)) + 1;
  // Move above the current order range before renumbering to preserve the unique index.
  await manager.query(
    `UPDATE ${table} SET image_order=image_order+$2 WHERE ${column}=$1 AND deleted_at IS NULL`,
    [ownerId, offset],
  );
  const ordered = [
    imageId,
    ...rows.filter((row) => row.id !== imageId).map((row) => row.id),
  ];
  for (const [index, id] of ordered.entries())
    await manager.query(
      `UPDATE ${table} SET image_order=$2, updated_at=now() WHERE id=$1`,
      [id, index + 1],
    );
  return true;
}
