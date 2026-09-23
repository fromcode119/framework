import { describe, expect, it, vi } from 'vitest';
import { MetaContextProxy } from '@core/plugin/context/meta';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * `context.meta.get` has no tenancy: at boot an unscoped read sees only rows with NO owner, because
 * the policy's first branch is `tenant_id = current_setting(...)` and that matches nothing when the
 * setting is empty.
 *
 * `set` used to pair that with a fan-out to EVERY tenant. So the `get` → merge → `set` that every
 * seed performs read a blank, merged into a blank, and wrote that blank over each site's real value.
 *
 * It happened: courier credentials transferred into a client site were present, then empty after
 * the next restart, with the row's `updated_at` unchanged so nothing looked like it had written.
 *
 * The per-site replay runs the same hook again WITH a store and a bound connection, so the write
 * belongs there — where the read sees the same site it is about to write.
 */
describe('a boot-time meta write cannot blank every tenant', () => {
  const managerWith = (writes: Array<{ method: string; value: unknown }>) => ({
    db: {
      findOne: vi.fn(async () => null),
      update: vi.fn(async (_t: string, _w: unknown, values: any) => { writes.push({ method: 'update', value: values?.value }); return null; }),
      insert: vi.fn(async (_t: string, values: any) => { writes.push({ method: 'insert', value: values?.value }); return null; }),
      withTenant: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
    },
  } as any);

  it('writes nothing outside a request', async () => {
    const writes: Array<{ method: string; value: unknown }> = [];
    const meta = MetaContextProxy.createMetaProxy(managerWith(writes));

    await meta.set('integration_shipping_provider_providers', JSON.stringify({ providers: [{ config: { username: '' } }] }));

    expect(writes, 'a blank derived from an unscoped read must not reach any site').toEqual([]);
  });

  it('writes exactly once inside a request, where the scope is real', async () => {
    const writes: Array<{ method: string; value: unknown }> = [];
    const meta = MetaContextProxy.createMetaProxy(managerWith(writes));

    await RequestContextUtils.storage.run({ tenantId: 'example-site' } as any, async () => {
      await meta.set('some_key', 'a real value');
    });

    expect(writes).toHaveLength(1);
    expect(writes[0].value).toBe('a real value');
  });
});
