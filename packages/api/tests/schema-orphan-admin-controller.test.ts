import { describe, expect, it, vi } from 'vitest';
import { SchemaOrphanAdminController } from '@api/controllers/system/schema-orphan-admin-controller';

/** The review lists what the platform proposed, and drops only a column it proposed. */
describe('SchemaOrphanAdminController', () => {
  const response = (): any => {
    const res: any = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
  };
  const controllerWith = (schemaManager: Record<string, unknown>) => new SchemaOrphanAdminController({ schemaManager });

  it('lists the undeclared columns with their counts', async () => {
    const columns = [{ table: 'fcp_a_items', column: 'old', rows: 4, nonEmpty: 0, firstSeenAt: '2026-10-01T00:00:00.000Z' }];
    const res = response();
    await controllerWith({ pendingDrops: vi.fn(async () => columns) }).list({} as any, res);
    expect(res.json).toHaveBeenCalledWith({ columns });
  });

  it('says so when the list cannot be read, instead of an empty list', async () => {
    const res = response();
    await controllerWith({ pendingDrops: vi.fn(async () => { throw new Error('db down'); }) }).list({} as any, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'schema_orphans_unavailable' });
  });

  it('refuses a drop without a table and a column', async () => {
    const approveDrop = vi.fn();
    const res = response();
    await controllerWith({ approveDrop }).drop({ body: { table: 'fcp_a_items' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(approveDrop).not.toHaveBeenCalled();
  });

  it('drops a proposed column and returns what it held', async () => {
    const entry = { table: 'fcp_a_items', column: 'old', firstSeenAt: '2026-10-01T00:00:00.000Z' };
    const approveDrop = vi.fn(async () => entry);
    const res = response();
    await controllerWith({ approveDrop }).drop({ body: { table: ' fcp_a_items ', column: 'old' } } as any, res);
    expect(approveDrop).toHaveBeenCalledWith('fcp_a_items', 'old');
    expect(res.json).toHaveBeenCalledWith({ dropped: entry });
  });

  it('answers 404 for a column nobody proposed, and 500 for a real failure', async () => {
    const notProposed = response();
    await controllerWith({ approveDrop: vi.fn(async () => { throw new Error('users.password is not awaiting approval. Only a column…'); }) })
      .drop({ body: { table: 'users', column: 'password' } } as any, notProposed);
    expect(notProposed.status).toHaveBeenCalledWith(404);

    const failed = response();
    await controllerWith({ approveDrop: vi.fn(async () => { throw new Error('lock timeout'); }) })
      .drop({ body: { table: 'fcp_a_items', column: 'old' } } as any, failed);
    expect(failed.status).toHaveBeenCalledWith(500);
    expect(failed.json).toHaveBeenCalledWith({ error: 'schema_drop_failed' });
  });
});
