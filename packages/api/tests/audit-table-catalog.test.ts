import { describe, expect, it, vi } from 'vitest';
import { AuditTableCatalogController } from '@api/controllers/system/audit-table-catalog-controller';

/** The audit exclusion is picked from the plugins' own tables, never typed. */
describe('AuditTableCatalogController', () => {
  it('lists every plugin table with its plugin and collection, and no framework table', async () => {
    const entries: Record<string, { pluginSlug: string }> = {
      fcp_analytics_sessions: { pluginSlug: 'analytics' },
      fcp_analytics_events: { pluginSlug: 'analytics' },
      fcp_cms_pages: { pluginSlug: 'cms' },
      users: { pluginSlug: 'system' },
    };
    const manager: any = {
      getCollections: () => [
        { slug: 'fcp_cms_pages', shortSlug: 'pages' },
        { slug: 'users', shortSlug: 'users' },
        { slug: 'fcp_analytics_sessions', shortSlug: 'sessions' },
        { slug: 'fcp_analytics_events', shortSlug: 'events' },
      ],
      getCollection: (slug: string) => entries[slug],
    };
    const res: any = { json: vi.fn() };
    await new AuditTableCatalogController(manager).list({} as any, res);
    expect(res.json).toHaveBeenCalledWith({ tables: [
      { table: 'fcp_analytics_events', plugin: 'analytics', collection: 'events' },
      { table: 'fcp_analytics_sessions', plugin: 'analytics', collection: 'sessions' },
      { table: 'fcp_cms_pages', plugin: 'cms', collection: 'pages' },
    ] });
  });
});
