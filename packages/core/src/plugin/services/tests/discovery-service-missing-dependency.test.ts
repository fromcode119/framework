import { describe, expect, it, vi } from 'vitest';
import { DiscoveryService } from '@core/plugin/services/installation/discovery-service';

/**
 * A site's plugin list is a subset of what is installed. Sorting it warned "depends on X but it's not
 * installed" for every dependency the site had not enabled, on every page's metadata request: hundreds of log
 * lines an hour about something that was installed.
 */
describe('sorting plugins that depend on one another', () => {
  const plugin = (slug: string, dependencies?: Record<string, string>): any => ({ manifest: { slug, dependencies } });
  const service = () => {
    const warn = vi.fn();
    const discovery = Object.create(DiscoveryService.prototype) as DiscoveryService;
    (discovery as any).logger = { warn };
    return { discovery, warn };
  };

  it('puts a plugin after what it depends on', () => {
    const { discovery } = service();
    const sorted = discovery.resolveDependencies([plugin('alpha', { base: '^0.1' }), plugin('base')]);
    expect(sorted.map((p: any) => p.manifest.slug)).toEqual(['base', 'alpha']);
  });

  it('warns about a dependency missing from the list when the list is everything installed', () => {
    const { discovery, warn } = service();
    discovery.resolveDependencies([plugin('alpha', { base: '^0.1' })]);
    expect(warn).toHaveBeenCalledWith('Plugin "alpha" depends on "base" but it\'s not installed.');
  });

  it('says nothing about a dependency a subset leaves out, and still sorts what it holds', () => {
    const { discovery, warn } = service();
    const sorted = discovery.resolveDependencies([plugin('alpha', { base: '^0.1' }), plugin('other')], { reportMissing: false });
    expect(warn).not.toHaveBeenCalled();
    expect(sorted.map((p: any) => p.manifest.slug).sort()).toEqual(['alpha', 'other']);
  });
});
