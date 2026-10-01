import { describe, expect, it } from 'vitest';
import { SystemSettingRegistry } from '@core/settings/system-setting-registry';

/**
 * The admin's number fields clamp to their bounds, but the API took any value: a CPU share of 30200% was
 * stored as given — a limit that limits nothing. A value outside a setting's declared range is refused.
 */
describe('setting ranges', () => {
  it('refuses a plugin isolation limit outside its range, naming the key', () => {
    const violations = SystemSettingRegistry.rangeViolations({
      plugin_isolation_site_cpu_percent: '30200',
      plugin_isolation_site_max_tasks: '4',
      plugin_isolation_memory_mb: 'lots',
    });
    expect(violations.map((v) => v.key).sort()).toEqual(['plugin_isolation_memory_mb', 'plugin_isolation_site_cpu_percent', 'plugin_isolation_site_max_tasks']);
    expect(violations.find((v) => v.key === 'plugin_isolation_site_cpu_percent')).toMatchObject({ min: 10, max: 100 });
  });

  it('accepts values in range, and empty — which means the declared default', () => {
    expect(SystemSettingRegistry.rangeViolations({
      plugin_isolation_site_cpu_percent: '30',
      plugin_isolation_site_memory_mb: '',
      plugin_isolation_site_disk_mb: 200,
      plugin_isolation_timeout_ms: null,
    })).toEqual([]);
  });

  it('leaves settings that declare no range alone', () => {
    expect(SystemSettingRegistry.rangeViolations({ maintenance_mode: 'anything' })).toEqual([]);
  });
});
