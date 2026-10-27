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

const courses = () => ({ slug: 'lms-courses', fields: [{ name: 'title', type: 'text' }] });

describe('extending a collection that registers later', () => {
  it('adds the fields once the owner registers it', () => {
    const manager = buildManager();
    const seo = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'seo' } } as any, manager, logger, security);
    const lms = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'lms' } } as any, manager, logger, security);
    seo.extend('lms', 'courses', { fields: [{ name: 'ogImage', type: 'text' }] } as any);
    lms.register(courses() as any);
    const names = manager.registeredCollections.get('fcp_lms_courses').collection.fields.map((f: any) => f.name);
    expect(names).toContain('ogImage');
  });
});
