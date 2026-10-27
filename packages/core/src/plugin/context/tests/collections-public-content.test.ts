import { describe, expect, it, vi } from 'vitest';
import { CollectionsContextProxy } from '@core/plugin/context/collections';

const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;
const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() } as any;

function buildManager() {
  const registeredCollections = new Map<string, { collection: any; pluginSlug: string }>();
  const listeners = new Map<string, Array<(data: any) => void>>();
  const hooks = {
    on: (event: string, fn: (data: any) => void) => listeners.set(event, [...(listeners.get(event) ?? []), fn]),
    off: vi.fn(),
    emit: (event: string, data: any) => (listeners.get(event) ?? []).forEach((fn) => fn(data)),
  };
  const plugins = new Map([
    ['host', { manifest: { slug: 'host', namespace: 'org.example' } }],
    ['other', { manifest: { slug: 'other', namespace: 'org.example' } }],
  ]);
  return {
    registeredCollections,
    hooks,
    plugins,
    emit: (event: string, data: any) => hooks.emit(event, data),
    getCollection: (slug: string) => registeredCollections.get(slug),
  } as any;
}

const proxy = (manager: any, slug: string) =>
  CollectionsContextProxy.createCollectionsProxy({ manifest: { slug } } as any, manager, logger, security);

const SEO_FIELDS = { fields: [{ name: 'seoTitle', type: 'text' }] } as any;
const fieldNames = (manager: any, table: string) => manager.registeredCollections.get(table).collection.fields.map((f: any) => f.name);

/**
 * A plugin that serves every public page (a sitemap, SEO fields) finds the collections holding them
 * from their own declaration, never from a list of plugin names it keeps itself.
 */
describe('context.collections.publicContent', () => {
  it('lists each declaring collection with its owner, namespace, declared and short slug and methods', async () => {
    const manager = buildManager();
    proxy(manager, 'host').register({ slug: 'host-items', displayName: 'Items', entity: 'product', publicContent: { list: 'listPublicItems', at: 'itemAt' }, fields: [] } as any);
    proxy(manager, 'host').register({ slug: 'host-drafts', fields: [] } as any);

    await expect(proxy(manager, 'other').publicContent()).resolves.toEqual([
      { plugin: 'host', namespace: 'org.example', slug: 'host-items', shortSlug: 'items', label: 'Items', entity: 'product', list: 'listPublicItems', at: 'itemAt' },
    ]);
  });
});

describe('context.collections.extendPublicContent', () => {
  it('adds the fields to every declaring collection, registered before or after, and to no other', () => {
    const manager = buildManager();
    proxy(manager, 'host').register({ slug: 'host-pages', publicContent: { list: 'listPublicPages' }, fields: [{ name: 'title', type: 'text' }] } as any);
    proxy(manager, 'host').register({ slug: 'host-drafts', fields: [] } as any);

    proxy(manager, 'seo').extendPublicContent(SEO_FIELDS);
    proxy(manager, 'other').register({ slug: 'other-posts', publicContent: { list: 'listPublicPosts' }, fields: [] } as any);

    expect(fieldNames(manager, 'fcp_host_pages')).toContain('seoTitle');
    expect(fieldNames(manager, 'fcp_other_posts')).toContain('seoTitle');
    expect(fieldNames(manager, 'fcp_host_drafts')).not.toContain('seoTitle');
    expect(manager.registeredCollections.get('fcp_other_posts').collection.fields.find((f: any) => f.name === 'seoTitle').extendedBy).toBe('seo');
  });

  it('never replaces a field the owner declares itself', () => {
    const manager = buildManager();
    proxy(manager, 'host').register({ slug: 'host-pages', publicContent: { list: 'listPublicPages' }, fields: [{ name: 'seoTitle', type: 'textarea' }] } as any);

    proxy(manager, 'seo').extendPublicContent(SEO_FIELDS);

    const fields = manager.registeredCollections.get('fcp_host_pages').collection.fields.filter((f: any) => f.name === 'seoTitle');
    expect(fields).toEqual([{ name: 'seoTitle', type: 'textarea' }]);
  });
});
