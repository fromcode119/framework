import { describe, it, expect, afterEach } from 'vitest';
import { LifecycleService } from '@core/plugin/services/lifecycle-service';
import { PluginApprovalMode } from '@core/plugin/services/enums/plugin-approval-mode.enum';

describe('LifecycleService.computeCapabilityDiff', () => {
  it('reports added and removed capabilities, order-independent', () => {
    const diff = LifecycleService.computeCapabilityDiff(['api', 'admin', 'scheduler'], ['admin', 'api']);
    expect(diff.added).toEqual(['scheduler']);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toBe(true);
  });
  it('flags removals too', () => {
    const diff = LifecycleService.computeCapabilityDiff(['api'], ['api', 'email']);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual(['email']);
    expect(diff.changed).toBe(true);
  });
  it('reports no change when sets match regardless of order', () => {
    const diff = LifecycleService.computeCapabilityDiff(['b', 'a'], ['a', 'b']);
    expect(diff.changed).toBe(false);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });
});

describe('capability gate auto-approve decision', () => {
  afterEach(() => { delete process.env.AUTO_APPROVE_PLUGIN_CAPABILITIES; delete process.env.AUTO_APPROVE_TRUSTED_SLUGS; });
  it('returns "hold" when auto-approve is off', () => {
    expect(LifecycleService.resolveDriftAction('ecommerce', true)).toBe(PluginApprovalMode.HOLD);
  });
  it('returns "auto-approve" when enabled and trusted', () => {
    process.env.AUTO_APPROVE_PLUGIN_CAPABILITIES = 'true';
    expect(LifecycleService.resolveDriftAction('ecommerce', true)).toBe(PluginApprovalMode.AUTO_APPROVE);
  });
  it('returns "hold" when enabled but untrusted', () => {
    process.env.AUTO_APPROVE_PLUGIN_CAPABILITIES = 'true';
    expect(LifecycleService.resolveDriftAction('forms', false)).toBe(PluginApprovalMode.HOLD);
  });
});
