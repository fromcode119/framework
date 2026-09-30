import { afterEach, describe, expect, it } from 'vitest';
import { PluginDatabaseQuota } from '@core/security/plugin-database-quota';

/**
 * The plugin database quota was a hardcoded 5000 calls a minute per plugin with every site counted
 * together. The limit is now the operator's setting, 0 means unlimited, and each site has its own count.
 */
describe('PluginDatabaseQuota', () => {
  afterEach(() => PluginDatabaseQuota.useLimit(() => 0));

  it('never refuses while the limit is 0', () => {
    PluginDatabaseQuota.useLimit(() => 0);
    for (let i = 0; i < 10000; i += 1) expect(PluginDatabaseQuota.allow('p-unlimited', 's1')).toBe(true);
  });

  it('refuses a plugin past its limit for one site, and keeps serving the others', () => {
    PluginDatabaseQuota.useLimit(() => 3);
    expect([1, 2, 3].map(() => PluginDatabaseQuota.allow('p-sites', 'busy'))).toEqual([true, true, true]);
    expect(PluginDatabaseQuota.allow('p-sites', 'busy')).toBe(false);
    expect(PluginDatabaseQuota.allow('p-sites', 'quiet')).toBe(true);
    expect(PluginDatabaseQuota.allow('p-other-plugin', 'busy')).toBe(true);
  });

  it('reads the limit on every call, so a saved change applies without a restart', () => {
    let limit = 1;
    PluginDatabaseQuota.useLimit(() => limit);
    expect(PluginDatabaseQuota.allow('p-live', 's1')).toBe(true);
    expect(PluginDatabaseQuota.allow('p-live', 's1')).toBe(false);
    limit = 0;
    expect(PluginDatabaseQuota.allow('p-live', 's1')).toBe(true);
  });
});
