import type { QueryRunner } from 'typeorm';
import { AlignAuthenticationSchema1793898000000 } from './1793898000000-AlignAuthenticationSchema';

describe('AlignAuthenticationSchema1793898000000', () => {
  it('allows password or Google authentication and reserves Google identities', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await new AlignAuthenticationSchema1793898000000().up({
      query,
    } as unknown as QueryRunner);

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('ALTER COLUMN "password_hash" DROP NOT NULL');
    expect(sql).toContain(
      'CHECK ("password_hash" IS NOT NULL OR "google_account_id" IS NOT NULL)',
    );
    expect(sql).toMatch(/WHERE "google_account_id" IS NOT NULL;\s*$/);
  });
});
