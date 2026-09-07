import { vi, type Mock } from 'vitest';
import { McpVersionTools } from '@ai/admin-assistant-runtime/helpers/mcp-version-tools';

/**
 * Record-version MCP tools. Motivated by a production incident: a product's localized field was wiped
 * by a save and the ONLY copy of the pre-wipe state lived in `_system_record_versions` — reachable in
 * the admin's Version History UI but not through the MCP surface, so a remote operator (or Claude over
 * the MCP token) could not inspect or restore it. These tools close that gap.
 */
describe('McpVersionTools', () => {
  const collection = { slug: 'fcp_ecommerce_products', shortSlug: 'catalog', label: 'Products', pluginSlug: 'ecommerce', raw: { primaryKey: 'id' } } as any;

  const buildOptions = (overrides?: Record<string, any>) => ({
    findCollectionBySlug: (source: string) => (source === 'fcp_ecommerce_products' || source === 'catalog' ? collection : null),
    listRecordVersions: vi.fn().mockResolvedValue({
      docs: [
        { id: 3, ref_id: '8', ref_collection: 'fcp_ecommerce_products', version: 3, created_at: '2026-08-18 11:28:00', updated_by: 'kristian.dimitrov@fromcode.com', change_summary: 'Update fcp_ecommerce_products record', version_data: '{"name":"x"}' },
        { id: 1, ref_id: '8', ref_collection: 'fcp_ecommerce_products', version: 1, created_at: '2026-04-18 09:06:00', updated_by: 'kristian.dimitrov@fromcode.com', change_summary: 'Update fcp_ecommerce_products record', version_data: '{"name":"y"}' },
      ],
      totalDocs: 2, limit: 20, offset: 0,
    }),
    getRecordVersion: vi.fn().mockResolvedValue({
      id: 1, ref_id: '8', ref_collection: 'fcp_ecommerce_products', version: 1,
      created_at: '2026-04-18 09:06:00', updated_by: 'kristian.dimitrov@fromcode.com',
      change_summary: 'Update fcp_ecommerce_products record',
      version_data: '{"short_description":"Кратко описание","name":"Годишен Нумерологичен Анализ"}',
    }),
    restoreRecordVersion: vi.fn().mockResolvedValue({ id: 8, name: 'Годишен Нумерологичен Анализ' }),
    ...overrides,
  }) as any;

  const toolByName = (options: any, name: string, dryRun = false) =>
    McpVersionTools.build(options, dryRun).find((tool) => tool.tool === name)!;

  it('declares list/get as read-only content:read and restore as content:write', () => {
    const tools = McpVersionTools.build(buildOptions(), false);
    const names = tools.map((tool) => tool.tool);
    expect(names).toEqual(['content.versions_list', 'content.version_get', 'content.version_restore']);
    expect(tools.find((t) => t.tool === 'content.versions_list')).toMatchObject({ readOnly: true, permission: 'content:read' });
    expect(tools.find((t) => t.tool === 'content.version_get')).toMatchObject({ readOnly: true, permission: 'content:read' });
    expect(tools.find((t) => t.tool === 'content.version_restore')).toMatchObject({ readOnly: false, permission: 'content:write' });
  });

  it('lists versions as camelCase summaries without the heavy snapshot payload', async () => {
    const options = buildOptions();
    const result = await toolByName(options, 'content.versions_list').handler({ collectionSlug: 'catalog', id: '8' }, {});

    expect(options.listRecordVersions).toHaveBeenCalledWith(collection, '8', { limit: 20, offset: 0 });
    expect(result.totalDocs).toBe(2);
    expect(result.versions).toEqual([
      { version: 3, createdAt: '2026-08-18 11:28:00', updatedBy: 'kristian.dimitrov@fromcode.com', changeSummary: 'Update fcp_ecommerce_products record' },
      { version: 1, createdAt: '2026-04-18 09:06:00', updatedBy: 'kristian.dimitrov@fromcode.com', changeSummary: 'Update fcp_ecommerce_products record' },
    ]);
    expect(JSON.stringify(result)).not.toContain('version_data');
  });

  it('returns one version with its snapshot parsed from JSON text', async () => {
    const result = await toolByName(buildOptions(), 'content.version_get').handler({ collectionSlug: 'fcp_ecommerce_products', id: '8', version: 1 }, {});

    expect(result.found).toBe(true);
    expect(result.version).toBe(1);
    expect(result.versionData).toEqual({ short_description: 'Кратко описание', name: 'Годишен Нумерологичен Анализ' });
  });

  it('reports a missing version as not found instead of throwing', async () => {
    const options = buildOptions({ getRecordVersion: vi.fn().mockResolvedValue(null) });
    const result = await toolByName(options, 'content.version_get').handler({ collectionSlug: 'catalog', id: '8', version: 99 }, {});
    expect(result.found).toBe(false);
  });

  it('previews a restore under dryRun without touching the record', async () => {
    const options = buildOptions();
    const result = await toolByName(options, 'content.version_restore').handler({ collectionSlug: 'catalog', id: '8', version: 1 }, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(options.restoreRecordVersion).not.toHaveBeenCalled();
    expect(result.versionData).toEqual({ short_description: 'Кратко описание', name: 'Годишен Нумерологичен Анализ' });
  });

  it('restores a version and reports the restored record', async () => {
    const options = buildOptions();
    const result = await toolByName(options, 'content.version_restore').handler({ collectionSlug: 'catalog', id: '8', version: 1 }, {});

    expect(options.restoreRecordVersion).toHaveBeenCalledWith(collection, '8', 1);
    expect(result.dryRun).toBe(false);
    expect(result.item).toEqual({ id: 8, name: 'Годишен Нумерологичен Анализ' });
  });

  it('rejects an unknown collection and an absent capability with clear errors', async () => {
    await expect(toolByName(buildOptions(), 'content.versions_list').handler({ collectionSlug: 'nope', id: '1' }, {})).rejects.toThrow('Unknown collection');
    const withoutCapability = buildOptions({ listRecordVersions: undefined });
    await expect(toolByName(withoutCapability, 'content.versions_list').handler({ collectionSlug: 'catalog', id: '1' }, {})).rejects.toThrow('not available');
  });
});
