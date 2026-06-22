import { describe, expect, it } from 'vitest';
import { AdminShellRegistry } from './admin-shell-registry';

const SimpleShell = () => null;

describe('AdminShellRegistry', () => {
  it('returns undefined for an appearance with no registered shell', () => {
    const registry = new AdminShellRegistry();
    expect(registry.resolve('default')).toBeUndefined();
  });

  it('registers and resolves a shell for an appearance', () => {
    const registry = new AdminShellRegistry();
    registry.register('simple', SimpleShell);
    expect(registry.resolve('simple')).toBe(SimpleShell);
    expect(registry.resolve('default')).toBeUndefined();
  });

  it('exposes a shared singleton instance', () => {
    expect(AdminShellRegistry.shared).toBeInstanceOf(AdminShellRegistry);
  });
});
