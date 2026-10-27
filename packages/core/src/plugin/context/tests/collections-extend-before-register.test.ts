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
  return {
    registeredCollections,
    hooks,
    emit: (event: string, data: any) => hooks.emit(event, data),
    getCollection: (slug: string) => registeredCollections.get(slug),
  } as any;
}

const items = () => ({ slug: 'host-items', fields: [{ name: 'title', type: 'text' }] });

describe('extending a collection that registers later', () => {
  it('adds the fields once the owner registers it', () => {
    const manager = buildManager();
    const extender = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'extender' } } as any, manager, logger, security);
    const host = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'host' } } as any, manager, logger, security);
    extender.extend('host', 'items', { fields: [{ name: 'ogImage', type: 'text' }] } as any);
    host.register(items() as any);
    const names = manager.registeredCollections.get('fcp_host_items').collection.fields.map((f: any) => f.name);
    expect(names).toContain('ogImage');
  });
});

describe('extending a collection again after a hot update', () => {
  it('replaces the field this extender added before, so the new release definition shows', () => {
    const manager = buildManager();
    const host = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'host' } } as any, manager, logger, security);
    host.register(items() as any);
    const before = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'extender' } } as any, manager, logger, security);
    before.extend('host', 'items', { fields: [{ name: 'ogImage', type: 'text', label: 'Old' }] } as any);
    const after = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'extender' } } as any, manager, logger, security);
    after.extend('host', 'items', { fields: [{ name: 'ogImage', type: 'text', label: 'New', admin: { component: 'Picker' } }] } as any);
    const fields = manager.registeredCollections.get('fcp_host_items').collection.fields.filter((f: any) => f.name === 'ogImage');
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ label: 'New', admin: { component: 'Picker' }, extendedBy: 'extender' });
  });

  it('never overwrites a field the owner declares, or one another extender added', () => {
    const manager = buildManager();
    const host = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'host' } } as any, manager, logger, security);
    host.register(items() as any);
    const first = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'first' } } as any, manager, logger, security);
    const second = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'second' } } as any, manager, logger, security);
    first.extend('host', 'items', { fields: [{ name: 'badge', type: 'text', label: 'First' }] } as any);
    second.extend('host', 'items', { fields: [{ name: 'badge', type: 'text', label: 'Second' }, { name: 'title', type: 'textarea' }] } as any);
    const fields = manager.registeredCollections.get('fcp_host_items').collection.fields;
    expect(fields.find((f: any) => f.name === 'badge')).toMatchObject({ label: 'First', extendedBy: 'first' });
    expect(fields.find((f: any) => f.name === 'title')).toEqual({ name: 'title', type: 'text' });
  });
});
