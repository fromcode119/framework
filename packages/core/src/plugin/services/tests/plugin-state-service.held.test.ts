import { describe, it, expect, vi } from 'vitest';
import { PluginStateService } from '@core/plugin/services/plugin-state-service';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';

function makeDb(existingRow: any = { slug: 'ecommerce' }) {
  return {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(existingRow),
    update: vi.fn().mockResolvedValue(1),
    insert: vi.fn().mockResolvedValue(1),
  } as any;
}

describe('PluginStateService.markPluginHeld', () => {
  it('writes inactive + warning + held_reason without touching capabilities', async () => {
    const db = makeDb();
    const svc = new PluginStateService(db);
    await svc.markPluginHeld('Ecommerce', PluginHeldReason.CAPABILITY_DRIFT);
    expect(db.update).toHaveBeenCalledTimes(1);
    const [, where, values] = db.update.mock.calls[0];
    expect(where).toEqual({ slug: 'ecommerce' });
    expect(values.state).toBe('inactive');
    expect(values.health_status).toBe('warning');
    expect(values.held_reason).toBe('capability_drift');
    expect(values).not.toHaveProperty('capabilities');
  });

  it('does nothing when the plugin row does not exist', async () => {
    const db = makeDb(null);
    const svc = new PluginStateService(db);
    await svc.markPluginHeld('ghost', PluginHeldReason.CAPABILITY_DRIFT);
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe('PluginStateService.loadInstalledPluginsState', () => {
  it('returns heldReason from the held_reason column', async () => {
    const db = makeDb();
    db.find.mockResolvedValue([
      { slug: 'ecommerce', state: 'inactive', capabilities: '["api"]', health_status: 'warning', held_reason: 'capability_drift' },
    ]);
    const svc = new PluginStateService(db);
    const reg = await svc.loadInstalledPluginsState();
    expect(reg['ecommerce'].heldReason).toBe(PluginHeldReason.CAPABILITY_DRIFT);
    expect(reg['ecommerce'].healthStatus).toBe(PluginRegistryHealth.WARNING);
  });

  it('surfaces signatureVerified from the signature_verified column', async () => {
    const db = makeDb();
    db.find.mockResolvedValue([
      { slug: 'x', state: 'active', capabilities: '[]', health_status: 'healthy', signature_verified: true },
    ]);
    const svc = new PluginStateService(db);
    const reg = await svc.loadInstalledPluginsState();
    expect(reg['x'].signatureVerified).toBe(true);
  });
});
