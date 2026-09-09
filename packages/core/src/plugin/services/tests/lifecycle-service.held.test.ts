import { describe, it, expect, afterEach } from 'vitest';
import { PluginBootHealthReporter } from '@core/plugin/services/runtime/plugin-boot-health-reporter';
import { LifecycleService } from '@core/plugin/services/runtime/lifecycle-service';
import { PluginApprovalMode } from '@core/plugin/services/enums/plugin-approval-mode.enum';

describe('PluginBootHealthReporter.computeCapabilityDiff', () => {
  it('reports added and removed capabilities, order-independent', () => {
    const diff = PluginBootHealthReporter.computeCapabilityDiff(['api', 'admin', 'scheduler'], ['admin', 'api']);
    expect(diff.added).toEqual(['scheduler']);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toBe(true);
  });
  it('flags removals too', () => {
    const diff = PluginBootHealthReporter.computeCapabilityDiff(['api'], ['api', 'email']);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual(['email']);
    expect(diff.changed).toBe(true);
  });
  it('reports no change when sets match regardless of order', () => {
    const diff = PluginBootHealthReporter.computeCapabilityDiff(['b', 'a'], ['a', 'b']);
    expect(diff.changed).toBe(false);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });
});

describe('capability gate auto-approve decision', () => {
  afterEach(() => { delete process.env.AUTO_APPROVE_PLUGIN_CAPABILITIES; delete process.env.AUTO_APPROVE_TRUSTED_SLUGS; });
  it('returns "hold" when auto-approve is off', () => {
    expect(PluginBootHealthReporter.resolveDriftAction('alpha', true)).toBe(PluginApprovalMode.HOLD);
  });
  it('returns "auto-approve" when enabled and trusted', () => {
    process.env.AUTO_APPROVE_PLUGIN_CAPABILITIES = 'true';
    expect(PluginBootHealthReporter.resolveDriftAction('alpha', true)).toBe(PluginApprovalMode.AUTO_APPROVE);
  });
  it('returns "hold" when enabled but untrusted', () => {
    process.env.AUTO_APPROVE_PLUGIN_CAPABILITIES = 'true';
    expect(PluginBootHealthReporter.resolveDriftAction('theta', false)).toBe(PluginApprovalMode.HOLD);
  });
});
