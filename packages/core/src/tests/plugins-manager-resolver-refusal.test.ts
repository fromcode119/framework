import { describe, expect, it, vi, afterEach } from 'vitest';
import { PluginsManagerResolver } from '@core/plugin/plugins-manager-resolver';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { TenantMode } from '@core/tenant/tenant-mode';

/**
 * Why a peer is absent, said out loud.
 *
 * `isResolvable` answered one `false` for three unrelated situations — not active, process down, not
 * enabled for this site — and a peer that failed any of them simply vanished from the guest's
 * snapshot. A cross-plugin call then failed naming neither the peer nor the reason: measured on a
 * live site, a courier city search answered `{"cities":[]}` in 80ms having asked nobody, and picking
 * between the three meant reasoning about in-memory state from outside the process.
 *
 * The three read differently to an operator — install it, restart it, enable it for this site — so
 * each has to be distinguishable.
 */
function plugin(overrides: Record<string, any> = {}) {
  return {
    manifest: { slug: 'shipping-adapter', namespace: 'org.fromcode' },
    state: 'active',
    publicAPI: { searchCities: () => [] },
    isRunning: () => true,
    ...overrides,
  } as any;
}

describe('PluginsManagerResolver.refusalReason', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('is null — no refusal — for an active, running plugin with no tenant in play', () => {
    expect(PluginsManagerResolver.refusalReason(plugin(), null)).toBeNull();
    expect(PluginsManagerResolver.isResolvable(plugin(), null)).toBe(true);
  });

  it('says a plugin is not active, and which state it is in', () => {
    const reason = PluginsManagerResolver.refusalReason(plugin({ state: 'held' }), null);
    expect(reason).toMatch(/not active/);
    expect(reason).toMatch(/held/);
  });

  it('says a plugin exposes no public API', () => {
    expect(PluginsManagerResolver.refusalReason(plugin({ publicAPI: null }), null)).toMatch(/no public API/);
  });

  it('distinguishes a CRASHED process from an inactive plugin — the pair that read identically', () => {
    const down = PluginsManagerResolver.refusalReason(plugin({ isRunning: () => false }), null);
    expect(down).toMatch(/process is not running/);
    // and it is NOT reported as a state or enablement problem, which would send the operator the wrong way
    expect(down).not.toMatch(/not active|not enabled/);
  });

  it('says a plugin is not enabled for THIS site, naming the site', () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    vi.spyOn(PluginTenantAccess, 'enabledSlugsFor').mockReturnValue(new Set<string>());
    const reason = PluginsManagerResolver.refusalReason(plugin(), 'example-site');
    expect(reason).toMatch(/not enabled for site/);
    expect(reason).toMatch(/example-site/);
  });

  it('is null when the site DOES have it enabled', () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    vi.spyOn(PluginTenantAccess, 'enabledSlugsFor').mockReturnValue(new Set(['shipping-adapter']));
    expect(PluginsManagerResolver.refusalReason(plugin(), 'example-site')).toBeNull();
  });

  it('keeps isResolvable in step — one predicate, not two', () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    vi.spyOn(PluginTenantAccess, 'enabledSlugsFor').mockReturnValue(new Set<string>());
    const p = plugin();
    expect(PluginsManagerResolver.isResolvable(p, 'site')).toBe(false);
    expect(PluginsManagerResolver.refusalReason(p, 'site')).not.toBeNull();
  });
});
