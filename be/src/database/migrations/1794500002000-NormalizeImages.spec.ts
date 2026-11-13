import type { QueryRunner } from 'typeorm';
import { NormalizeImages1794500002000 } from './1794500002000-NormalizeImages';

describe('NormalizeImages1794500002000', () => {
  it('creates shared image metadata and all owner mappings', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await new NormalizeImages1794500002000().up({
      hasTable: jest.fn().mockResolvedValue(false),
      query,
    } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE "images"');
    expect(sql).toContain('"storage_provider" varchar(30)');
    expect(sql).toContain('"object_key" varchar(500)');
    expect(sql).toContain('CREATE TABLE "hotel_images"');
    expect(sql).toContain('CREATE TABLE "room_images"');
    expect(sql).toContain('CREATE TABLE "place_images"');
    expect(sql).toContain('CREATE TABLE "user_images"');
    expect(sql).toContain('"image_order" integer NOT NULL DEFAULT 1');
  });

  it('refuses to rebuild image tables containing data', async () => {
    const migration = new NormalizeImages1794500002000();
    const query = jest.fn().mockResolvedValue([{ count: 1 }]);

    await expect(
      migration.up({
        hasTable: jest.fn().mockResolvedValue(true),
        query,
      } as unknown as QueryRunner),
    ).rejects.toThrow('migration stopped to prevent data loss');

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('FROM "hotel_images"');
  });
});
