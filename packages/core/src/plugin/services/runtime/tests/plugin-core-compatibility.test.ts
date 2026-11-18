import { describe, expect, it } from 'vitest';
import { PluginCoreCompatibility } from '@core/plugin/services/runtime/plugin-core-compatibility';

describe('PluginCoreCompatibility.check', () => {
  it('a plugin that declares no requirement runs on any core (older plugins predate the field)', () => {
    expect(PluginCoreCompatibility.check({}, '0.2.602').ok).toBe(true);
    expect(PluginCoreCompatibility.check({ engines: {} }, '0.2.602').ok).toBe(true);
    expect(PluginCoreCompatibility.check(null, '0.2.602').ok).toBe(true);
  });

  it('refuses when the running core is below the declared minimum, allows when it meets it', () => {
    // The real incident: ecommerce 0.1.483 needed core >=0.2.603, the site ran 0.2.602.
    const needs603 = { engines: { core: '>=0.2.603' } };
    expect(PluginCoreCompatibility.check(needs603, '0.2.602')).toMatchObject({ ok: false, required: '>=0.2.603', running: '0.2.602' });
    expect(PluginCoreCompatibility.check(needs603, '0.2.603').ok).toBe(true);
    expect(PluginCoreCompatibility.check(needs603, '0.2.700').ok).toBe(true);
  });

  it('reads a core version that carries a build/prerelease suffix', () => {
    const needs603 = { engines: { core: '>=0.2.603' } };
    expect(PluginCoreCompatibility.check(needs603, '0.2.610-rc.1').ok).toBe(true);
    expect(PluginCoreCompatibility.check(needs603, 'v0.2.602').ok).toBe(false);
  });

  it('fails OPEN: an unparsable running version, or a nonsense range, never blocks', () => {
    expect(PluginCoreCompatibility.check({ engines: { core: '>=0.2.603' } }, 'unknown').ok).toBe(true);
    expect(PluginCoreCompatibility.check({ engines: { core: 'not-a-range' } }, '0.2.602').ok).toBe(true);
  });

  it('message names the versions and the fix', () => {
    const c = PluginCoreCompatibility.check({ engines: { core: '>=0.2.603' } }, '0.2.602');
    const m = PluginCoreCompatibility.message('ecommerce', c);
    expect(m).toContain('>=0.2.603');
    expect(m).toContain('0.2.602');
    expect(m).toContain('Settings → Updates');
  });
});
