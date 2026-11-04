// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { RuntimeRegistryAccess } from '@core/runtime-registry-access';

describe('RuntimeRegistryAccess — locked runtime module registry', () => {
  it('lets the framework register, and refuses page-script writes, deletes and replacement', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const react = { createElement: () => null };
    RuntimeRegistryAccess.register('react', react);
    const view = RuntimeRegistryAccess.ensure();
    const name = RuntimeRegistryAccess.globalName;

    (view as any).react = { evil: true };
    delete (view as any).react;
    Object.defineProperty(view, 'react', { value: 1 });
    try { (window as any)[name] = {}; } catch { /* non-writable */ }

    expect(view.react).toBe(react);
    expect((window as any)[name]).toBe(view);
    expect(Object.getOwnPropertyDescriptor(window, name)).toMatchObject({ writable: false, configurable: false });
    expect(warn).toHaveBeenCalled();

    // The framework's own writer still replaces an entry (the pre-boot stub → the real bridge).
    const next = { createElement: () => null };
    RuntimeRegistryAccess.register('react', next);
    expect(view.react).toBe(next);
  });
});
