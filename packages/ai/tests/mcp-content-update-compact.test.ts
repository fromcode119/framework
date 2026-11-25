import { vi } from 'vitest';
import { McpContentTools } from '@ai/admin-assistant-runtime/helpers/mcp-content-tools';

/**
 * content.update answers with the whole updated record by default (the admin assistant draws its preview
 * from it). A caller that only wants to know what was saved passes compact: true and gets the target and
 * the names of the changed fields — not the record, which for a product with variants is tens of KB.
 */
describe('content.update compact answer', () => {
  const collection = { slug: 'fcp_beta_products', shortSlug: 'catalog', label: 'Products', pluginSlug: 'beta', raw: { primaryKey: 'id' } } as any;
  const build = () => {
    const updateContent = vi.fn(async (_c: any, _id: any, data: any) => ({ id: 7, name: 'Shirt', ...data, publicPage: { big: 'x'.repeat(5000) } }));
    const tools = McpContentTools.build({
      findCollectionBySlug: (slug: string) => (slug === 'fcp_beta_products' ? collection : null),
      resolveContent: vi.fn(async () => ({ id: 7, name: 'Shirt', variants: [{ key: 'S', stock: 3 }], seoTitle: 'a' })),
      updateContent,
    } as any, false);
    return { update: tools.find((t) => t.tool === 'content.update')!, updateContent };
  };
  const data = { variants: [{ key: 'S', stock: 0 }], seoTitle: 'a' };

  it('keeps the full answer by default', async () => {
    const { update } = build();
    const out: any = await update.handler({ collectionSlug: 'fcp_beta_products', id: '7', data }, {} as any);
    expect(out.item.publicPage).toBeTruthy();
    expect(out.before).toBeTruthy();
    expect(out.visualPreview).toBeTruthy();
  });

  it('answers with the target and the changed field names only when compact', async () => {
    const { update, updateContent } = build();
    const out: any = await update.handler({ collectionSlug: 'fcp_beta_products', id: '7', data, compact: true }, {} as any);
    expect(updateContent).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ dryRun: false, ok: true, target: { collectionSlug: 'fcp_beta_products', primaryKey: 'id', id: 7 }, changedFields: ['variants'] });
    expect(JSON.stringify(out).length).toBeLessThan(200);
  });

  it('a dry run is never compacted — it saves nothing and its preview is the point', async () => {
    const { update, updateContent } = build();
    const out: any = await update.handler({ collectionSlug: 'fcp_beta_products', id: '7', data, compact: true }, { dryRun: true } as any);
    expect(updateContent).not.toHaveBeenCalled();
    expect(out.dryRun).toBe(true);
    expect(out.before).toBeTruthy();
  });
});
