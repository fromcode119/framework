import { afterEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { DatabasePoolRegistry } from '@database/pool/database-pool-registry';
import { PlatformPool } from '@database/tenant/platform-pool';

/** pg reads `options.max` each time it decides whether to open another connection. */
describe('DatabasePoolRegistry', () => {
  afterEach(() => DatabasePoolRegistry.useRequestPoolMax(() => DatabasePoolRegistry.PG_DEFAULT_MAX));

  it('sizes a request pool from the operator\'s setting, live, and leaves the platform pool as created', async () => {
    const requests = new Pool({ connectionString: 'postgres://u:p@127.0.0.1:1/x' });
    const platform = new Pool({ connectionString: 'postgres://u:p@127.0.0.1:1/x', max: 1 });
    DatabasePoolRegistry.add(requests);
    DatabasePoolRegistry.add(platform);
    PlatformPool.mark(platform);

    let setting = 20;
    DatabasePoolRegistry.useRequestPoolMax(() => setting);
    expect((requests as any).options.max).toBe(20);
    setting = 35;
    expect((requests as any).options.max).toBe(35);
    expect((platform as any).options.max).toBe(1);

    const snapshot = DatabasePoolRegistry.snapshots().find((pool) => pool.name === 'requests');
    expect(snapshot?.max).toBe(35);
    await Promise.all([requests.end(), platform.end()]);
  });
});
