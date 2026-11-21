import { describe, expect, it, vi } from 'vitest';
import { PluginRegistrationState } from '@core/plugin/services/runtime/plugin-registration-state';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';

/**
 * A plugin held because it needed a newer core was held on its way to being enabled. Once the core is
 * updated it must come back by itself; it stayed off until somebody found it and enabled it by hand.
 */
const resolve = (saved: any) => {
  const gate: any = { carryForward: vi.fn(async (_slug: string, _manifest: any, approved: string[]) => approved) };
  const state = new PluginRegistrationState({}, { savePluginState: vi.fn(), markPluginHeld: vi.fn() }, { warn: vi.fn() }, gate);
  return state.resolve('shop', { manifest: { slug: 'shop', version: '1.0.0' } } as any, { shop: saved });
};

describe('PluginRegistrationState — a plugin held for an old core', () => {
  it('comes back wanted-active, so enable() checks the core again', async () => {
    const result = await resolve({ state: 'inactive', heldReason: 'core_too_old', approvedCapabilities: [] });
    expect(result.state).toBe(PluginState.ACTIVE);
    expect(result.heldReason).toBeUndefined();
  });

  it('keeps any other hold as it was', async () => {
    const result = await resolve({ state: 'inactive', heldReason: 'capability_drift', approvedCapabilities: [] });
    expect(PluginState.resolve(result.state)).toBe(PluginState.INACTIVE);
    expect(PluginHeldReason.resolve(result.heldReason)).toBe(PluginHeldReason.CAPABILITY_DRIFT);
  });

  it('leaves a plain inactive plugin off', async () => {
    const result = await resolve({ state: 'inactive', approvedCapabilities: [] });
    expect(PluginState.resolve(result.state)).toBe(PluginState.INACTIVE);
  });
});
