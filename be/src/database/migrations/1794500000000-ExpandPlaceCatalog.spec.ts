import type { QueryRunner } from 'typeorm';
import { BackfillPlaceCatalog1794500001000 } from './1794500001000-BackfillPlaceCatalog';
import { ExpandPlaceCatalog1794500000000 } from './1794500000000-ExpandPlaceCatalog';

describe('place catalog migrations', () => {
  it('adds planner fields and keeps search indexed by city', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await new ExpandPlaceCatalog1794500000000().up({
      query,
    } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('ADD "estimated_visit_duration_minutes" integer');
    expect(sql).toContain('ADD "catalog_version" integer NOT NULL DEFAULT 1');
    expect(sql).toContain('coalesce("city", \'\')');
    expect(sql).toContain('USING GIN ("search_document")');
    expect(sql).toContain('USING GIN ("amenities")');
  });

  it('seeds the stable place category codes', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await new BackfillPlaceCatalog1794500001000().up({
      query,
    } as unknown as QueryRunner);

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("('ATTRACTION', 'Điểm tham quan'");
    expect(sql).toContain("('RESTAURANT', 'Nhà hàng'");
    expect(sql).toContain("('HOTEL', 'Khách sạn'");
  });
});
