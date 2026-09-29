import { describe, expect, it, vi } from 'vitest';
import { DatabaseContextProxy } from '@core/plugin/context/database';
import { PluginEntityRegistrationService } from '@core/plugin/services/plugin-entity-registration-service';
import { CollectionArchive } from '@core/collections/collection-archive';

const plugin = { manifest: { slug: 'shop', name: 'shop', version: '1.0.0' } } as any;
const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;

function buildManager(archivable: boolean) {
  return {
    db: {
      find: vi.fn(async () => []),
      findOne: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      groupCount: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
    },
    audit: { logAction: vi.fn() },
    getCollection: () => ({ collection: { fields: [], archive: archivable ? {} : undefined } }),
  } as any;
}

describe('context.db on an archivable collection', () => {
  it('leaves archived rows out of find, count and groupCount', async () => {
    const manager = buildManager(true);
    const db = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await db.find('fcp_shop_orders', { where: { status: 'paid' } });
    await db.count('fcp_shop_orders', {});
    await db.groupCount('fcp_shop_orders', { groupBy: ['status'] });
    expect(manager.db.find.mock.calls[0][1].where).toEqual({ status: 'paid', archivedAt: null });
    expect(manager.db.count.mock.calls[0][1].where).toEqual({ archivedAt: null });
    expect(manager.db.groupCount.mock.calls[0][1].where).toEqual({ archivedAt: null });
  });

  it('answers a point lookup whatever its archive state, so a taken number stays taken', async () => {
    const manager = buildManager(true);
    const db = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await db.findOne('fcp_shop_orders', { orderNumber: 'ORD-000001' });
    expect(manager.db.findOne.mock.calls[0][1]).toEqual({ orderNumber: 'ORD-000001' });
  });

  it('keeps a where that already states the archive, and withArchived reads everything', async () => {
    const manager = buildManager(true);
    const db = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await db.find('fcp_shop_orders', { where: { archivedAt: { ne: null } } });
    await db.withArchived.find('fcp_shop_orders', { where: { status: 'paid' } });
    await db.withArchived.stored.find('fcp_shop_orders', {});
    expect(manager.db.find.mock.calls[0][1].where).toEqual({ archivedAt: { ne: null } });
    expect(manager.db.find.mock.calls[1][1].where).toEqual({ status: 'paid' });
    expect(manager.db.find.mock.calls[2][1].where).toBeUndefined();
  });

  it('does not touch a collection that is not archivable, or a write', async () => {
    const manager = buildManager(false);
    const db = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await db.find('fcp_shop_orders', { where: { status: 'paid' } });
    expect(manager.db.find.mock.calls[0][1].where).toEqual({ status: 'paid' });

    const archivableManager = buildManager(true);
    const archivableDb = DatabaseContextProxy.createDatabaseProxy(plugin, archivableManager, security);
    await archivableDb.update('fcp_shop_orders', { id: 1 }, { status: 'paid' });
    expect(archivableManager.db.update.mock.calls[0][1]).toEqual({ id: 1 });
  });
});

describe('registering an archivable collection', () => {
  it('gives it the two visible, read-only archive fields', () => {
    const service = new PluginEntityRegistrationService();
    const collection = service.applyFrameworkFields({ slug: 'fcp_shop_orders', fields: [{ name: 'orderNumber', type: 'text' }], archive: {} } as any);
    const names = collection.fields.map((field) => field.name);
    expect(names).toEqual(['orderNumber', CollectionArchive.ARCHIVED_AT, CollectionArchive.ARCHIVED_WITH]);
    for (const field of collection.fields.slice(1)) {
      expect(field.admin?.readOnly).toBe(true);
      expect(field.admin?.hidden).toBeUndefined();
      expect(field.admin?.description).toBeTruthy();
    }
  });

  it('gives nothing to a collection that does not declare archive', () => {
    const service = new PluginEntityRegistrationService();
    const collection = service.applyFrameworkFields({ slug: 'fcp_shop_pages', fields: [{ name: 'title', type: 'text' }] } as any);
    expect(collection.fields.map((field) => field.name)).toEqual(['title']);
  });
});
