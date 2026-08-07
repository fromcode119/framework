import { describe, expect, it } from 'vitest';
import { PluginModuleResolverService } from '@core/plugin/services/plugin-module-resolver-service';

class DemoPluginLifecycle {
  static async onInit(ctx: any): Promise<void> { ctx.calls.push('onInit'); }
  static async onEnable(ctx: any): Promise<void> { ctx.calls.push('onEnable'); }
}

/** The canonical entry shape: statics holding references to a lifecycle class. */
class DemoPlugin {
  static readonly onInit = DemoPluginLifecycle.onInit;
  static readonly onEnable = DemoPluginLifecycle.onEnable;
  static readonly publicAPI = { ping: () => 'pong' };
  static readonly internalHelper = 'not part of the contract';
}

/** Entries may also declare the lifecycle as static METHODS (non-enumerable own properties). */
class MethodPlugin {
  static async onInit(ctx: any): Promise<void> { ctx.calls.push('methodInit'); }
}

/** Inline-manifest entries (build-server) carry `manifest` as a static too. */
class ManifestPlugin {
  static readonly manifest = { slug: 'inline', version: '1.2.3' };
  static readonly onInit = DemoPluginLifecycle.onInit;
}

class NotAPlugin {
  static readonly somethingElse = true;
}

describe('PluginModuleResolverService', () => {
  it('lifts contract statics off an exported class and leaves the rest behind', async () => {
    const resolved = PluginModuleResolverService.resolve({ DemoPlugin });

    expect(Object.keys(resolved).sort()).toEqual(['onEnable', 'onInit', 'publicAPI']);
    expect(resolved.internalHelper).toBeUndefined();

    const ctx = { calls: [] as string[] };
    await resolved.onInit(ctx);
    await resolved.onEnable(ctx);
    expect(ctx.calls).toEqual(['onInit', 'onEnable']);
    expect(resolved.publicAPI.ping()).toBe('pong');
  });

  it('lifts static METHODS, not just static fields', async () => {
    const resolved = PluginModuleResolverService.resolve({ MethodPlugin });
    const ctx = { calls: [] as string[] };
    await resolved.onInit(ctx);
    expect(ctx.calls).toEqual(['methodInit']);
  });

  it('lifts an inline manifest', () => {
    const resolved = PluginModuleResolverService.resolve({ ManifestPlugin });
    expect(resolved.manifest).toEqual({ slug: 'inline', version: '1.2.3' });
  });

  it('ignores exported classes that declare no contract static', () => {
    const resolved = PluginModuleResolverService.resolve({ NotAPlugin, DemoPlugin });
    expect(resolved.onInit).toBe(DemoPluginLifecycle.onInit);
  });

  it('still accepts the legacy default-export object shipped by third-party plugins', () => {
    const onInit = async () => {};
    const resolved = PluginModuleResolverService.resolve({ default: { onInit, publicAPI: { a: 1 } } });
    expect(resolved.onInit).toBe(onInit);
    expect(resolved.publicAPI).toEqual({ a: 1 });
  });

  it('still accepts a legacy CommonJS module.exports object', () => {
    const onInit = async () => {};
    expect(PluginModuleResolverService.resolve({ onInit }).onInit).toBe(onInit);
  });

  it('returns an empty object for an empty module', () => {
    expect(PluginModuleResolverService.resolve(null)).toEqual({});
    expect(PluginModuleResolverService.resolve(undefined)).toEqual({});
  });
});
