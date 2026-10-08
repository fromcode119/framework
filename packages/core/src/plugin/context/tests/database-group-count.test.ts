import { describe, expect, it, vi } from 'vitest';
import { DatabaseContextProxy } from '@core/plugin/context/database';
import { RequestContextUtils } from '@core/context/request-context';

const plugin = { manifest: { slug: 'alpha', name: 'alpha', version: '1.0.0' } } as any;
const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;

/**
 * Plugin code reads one name per field, camelCase, everywhere. A grouped count is keyed by the
 * columns it groups by, and those came back as the dialect writes them (`source_id`), so a plugin
 * grouping by `sourceId` found no `sourceId` on any group.
 */
describe('context.db.groupCount', () => {
  it('names each group by the fields it was asked to group by, as plugin code names them', () => RequestContextUtils.storage.run({ tenantId: 't1' }, async () => {
    const manager = {
      db: { groupCount: vi.fn(async () => [{ kind: 'product', source_id: 'product:11', count: 2 }]) },
      audit: { logAction: vi.fn() },
      getCollection: () => null,
    } as any;
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);

    const groups = await db.groupCount('fcp_alpha_items', { where: { kind: 'product' }, groupBy: ['kind', 'sourceId'] });

    expect(groups).toEqual([{ kind: 'product', sourceId: 'product:11', count: 2 }]);
  }));
});
