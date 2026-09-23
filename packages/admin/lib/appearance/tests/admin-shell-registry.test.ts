import { describe, expect, it } from 'vitest';
import { AdminShellRegistry } from '@/lib/appearance/admin-shell-registry';

const PlainShell = () => null;

describe('AdminShellRegistry', () => {
  it('returns undefined for an appearance with no registered shell', () => {
    const registry = new AdminShellRegistry();
    expect(registry.resolve('default')).toBeUndefined();
  });

  it('registers and resolves a shell for an appearance', () => {
    const registry = new AdminShellRegistry();
    registry.register('plain', PlainShell);
    expect(registry.resolve('plain')).toBe(PlainShell);
    expect(registry.resolve('default')).toBeUndefined();
  });

  it('exposes a shared singleton instance', () => {
    expect(AdminShellRegistry.shared).toBeInstanceOf(AdminShellRegistry);
  });
});
