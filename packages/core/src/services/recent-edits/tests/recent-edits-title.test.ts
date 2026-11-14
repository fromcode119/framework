import { describe, expect, it } from 'vitest';
import { RecentEditsService } from '@core/services/recent-edits/recent-edits-service';

/**
 * "Where you left off" titled an order "Orders 2" — the collection's declared English name and the id —
 * beside the console's own "Поръчки", because it never read the field the collection names as its title.
 */
const service = (versionData: Record<string, unknown>) => new RecentEditsService({
  findVersions: async () => [{ ref_collection: 'fcp_shop_orders', ref_id: '2', updated_by: '7', version_data: versionData, updated_at: '2026-11-14' }],
  listCollections: () => [{ tableName: 'fcp_shop_orders', shortSlug: 'orders', pluginSlug: 'shop', label: 'Orders', admin: { useAsTitle: 'orderNumber' } }],
});

describe('recent edits title', () => {
  it('reads the field the collection names as its title', async () => {
    const [edit] = await service({ orderNumber: 'ORD-1002', email: 'a@example.test' }).list('7', 5);
    expect(edit.title).toBe('ORD-1002');
  });

  it('is the record number when nothing names it, never the collection name again', async () => {
    const [edit] = await service({ items: [] }).list('7', 5);
    expect(edit.title).toBe('#2');
  });
});
