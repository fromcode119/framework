import { describe, expect, it, vi } from 'vitest';
import { ContextSecurityProxy } from '@core/plugin/context/utils';

const logger = { error: vi.fn(), warn: vi.fn() } as any;

function helpers(approvedCapabilities: string[]) {
  const manager = { audit: { logAction: vi.fn() }, disableWithError: vi.fn() } as any;
  const plugin = { manifest: { slug: 'demo', capabilities: ['database', 'integration:extra'] }, approvedCapabilities } as any;
  return { manager, security: ContextSecurityProxy.createSecurityHelpers(plugin, manager, logger) };
}

describe('ContextSecurityProxy.handleViolation', () => {
  it('refuses a held plugin without marking it as failed, so its hold stays visible', () => {
    const { manager, security } = helpers(['database']);
    expect(security.hasCapability('database:read')).toBe(false);
    expect(() => security.handleViolation('database:read')).toThrow('waiting for approval');
    expect(manager.disableWithError).not.toHaveBeenCalled();
  });

  it('still disables an approved plugin that uses a capability it never declared', () => {
    const { manager, security } = helpers(['database', 'integration:extra']);
    expect(() => security.handleViolation('database:raw')).toThrow('Security Violation');
    expect(manager.disableWithError).toHaveBeenCalledWith('demo', 'Security Violation: Missing "database:raw" capability.');
  });
});
