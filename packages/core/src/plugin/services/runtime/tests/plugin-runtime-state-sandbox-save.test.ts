import { describe, expect, it } from 'vitest';
import { Schema } from '@fromcode119/database';
import { PluginRuntimeStateService } from '@core/plugin/services/runtime/plugin-runtime-state-service';

/**
 * Saving a plugin's memory/timeout limits (Plugins → a plugin → Resource limits → Update Policy).
 * It wrote to an undefined table — the database package no longer exports a bare `systemPlugins` — so
 * every save answered 500 and nothing was stored, while the field kept showing the new value.
 */
describe('PluginRuntimeStateService.saveSandboxConfig', () => {
  it('stores the limits on the plugins table and applies them to the loaded manifest', async () => {
    const writes: Array<{ table: unknown; where: unknown; data: any }> = [];
    const db = { update: async (table: unknown, where: unknown, data: unknown) => { writes.push({ table, where, data }); return { id: 1 }; } };
    const plugin: any = { manifest: { slug: 'demo', sandbox: { memoryLimit: 256 } } };
    const service = new PluginRuntimeStateService({ info: () => undefined } as any, db, {} as any, new Map([['demo', plugin]]), new Map(), new Map(), new Map());

    await service.saveSandboxConfig('demo', { enabled: true, memoryLimit: 300, timeout: 20000 });

    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe(Schema.systemPlugins);
    expect(writes[0].where).toEqual({ slug: 'demo' });
    expect(writes[0].data).toEqual({ sandboxConfig: { memoryLimit: 300, timeout: 20000 } });
    expect(plugin.manifest.sandbox).toEqual({ memoryLimit: 300, timeout: 20000 });
  });
  it('stores only the limits — never a "run shared" or native-access flag nothing obeys', async () => {
    const writes: any[] = [];
    const db = { update: async (_t: unknown, _w: unknown, data: unknown) => { writes.push(data); return { id: 1 }; } };
    const plugin: any = { manifest: { slug: 'demo', sandbox: { memoryLimit: 256, timeout: 5000 } } };
    const service = new PluginRuntimeStateService({ info: () => undefined } as any, db, {} as any, new Map([['demo', plugin]]), new Map(), new Map(), new Map());

    await service.saveSandboxConfig('demo', { enabled: false, allowNative: true, memoryLimit: '512', timeout: 0, extra: 'x' });
    expect(writes[0]).toEqual({ sandboxConfig: { memoryLimit: 512 } });
    expect(plugin.manifest.sandbox).toEqual({ memoryLimit: 512 });

    await service.saveSandboxConfig('demo', false);
    expect(writes[1]).toEqual({ sandboxConfig: {} });
    expect(plugin.manifest.sandbox).toEqual({});
  });
});
