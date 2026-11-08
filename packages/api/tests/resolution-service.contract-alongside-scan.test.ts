vi.mock('@fromcode119/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@fromcode119/core');
  return { ...actual, CoreServices: { getInstance: vi.fn(), reset: vi.fn() } };
});

import { CoreServices, PluginState } from '@fromcode119/core';
import { ResolutionService } from '@api/services/resolution-service';

/**
 * A product's address is found by its plugin's page contract, after the scan of every collection finds
 * nothing. The two used to run one after the other (Server-Timing on TPS: the scan 21 ms, then the match
 * 18 ms); the match asks nothing of the scan, so it now starts with it. What it must not change: a custom
 * permalink or an exact slug still beats a contract, and a contract failure is only the caller's when the
 * contract was needed.
 */
describe('ResolutionService runs the contract match alongside the priority scan', () => {
  const build = (scan: () => Promise<unknown>, contract: () => Promise<unknown>) => {
    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      contentResolutionGates: { apply: vi.fn(async (resolved: any) => resolved) },
      redirectResolvers: { resolve: vi.fn(async () => null) },
      canonicalPathResolvers: { resolve: vi.fn(async () => null) },
      defaultPageContractResolution: { resolveAll: vi.fn().mockReturnValue([]) },
    } as any);
    const manager: any = {
      db: { find: vi.fn().mockResolvedValue([]) },
      getPlugins: vi.fn().mockReturnValue([{ state: PluginState.ACTIVE, manifest: { slug: 'shop' } }]),
      registeredCollections: new Map(),
    };
    const themeManager: any = { getActiveThemeDefaultPageContractOverrides: vi.fn().mockResolvedValue([]) };
    const service: any = new ResolutionService(manager, themeManager, { find: vi.fn() } as any);
    service.scanner = { scanPriority: vi.fn(scan), scanStructure: vi.fn(async () => null), isPermalinkDisabled: vi.fn(async () => false) };
    service.contractMatcher = { resolve: vi.fn(contract) };
    return service as ResolutionService & { scanner: any; contractMatcher: any };
  };

  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

  it('starts the contract match before the scan has finished', async () => {
    const order: string[] = [];
    const service = build(
      async () => { order.push('scan:start'); await new Promise((resolve) => setTimeout(resolve, 15)); order.push('scan:end'); return null; },
      async () => { order.push('contract:start'); return { type: 'catalog', plugin: 'shop', doc: { id: 7 } }; },
    );
    const result = await service.resolveSlug('/shop/a-product', {});
    expect(result).toMatchObject({ type: 'catalog', plugin: 'shop' });
    expect(order.indexOf('contract:start')).toBeLessThan(order.indexOf('scan:end'));
  });

  it('a custom permalink or an exact slug still beats a contract', async () => {
    const service = build(
      async () => ({ type: 'pages', plugin: 'system', doc: { id: 1 } }),
      async () => ({ type: 'catalog', plugin: 'shop', doc: { id: 7 } }),
    );
    expect(await service.resolveSlug('/shop/a-product', {})).toMatchObject({ type: 'pages', plugin: 'system' });
  });

  it('a contract that fails does not surface when the scan found the page', async () => {
    const service = build(
      async () => ({ type: 'pages', plugin: 'system', doc: { id: 1 } }),
      async () => { throw new Error('plugin process restarting'); },
    );
    await expect(service.resolveSlug('/anything', {})).resolves.toMatchObject({ type: 'pages' });
  });

  it('a contract that fails is the caller\'s when nothing else found the page, as before', async () => {
    const service = build(async () => null, async () => { throw new Error('plugin process restarting'); });
    await expect(service.resolveSlug('/shop/a-product', {})).rejects.toThrow('plugin process restarting');
  });

  it('falls through to the structure search when neither the scan nor the contract found it', async () => {
    const service = build(async () => null, async () => null);
    expect(await service.resolveSlug('/nothing-here', {})).toBeNull();
    expect(service.scanner.scanStructure).toHaveBeenCalledTimes(1);
  });
});
