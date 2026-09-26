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
});
