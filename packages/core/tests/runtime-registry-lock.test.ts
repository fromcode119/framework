// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { RuntimeHostModule } from '@core/constants/runtime-host-module.constants';
import { RuntimeRegistryAccess } from '@core/runtime-registry-access';

const load = (url: string) => import(/* @vite-ignore */ url);

describe('RuntimeRegistryAccess — no window registry', () => {
  it('keeps its entries off window entirely', () => {
    const before = Object.getOwnPropertyNames(window).filter((name) => name.startsWith('__fromcode'));
    const react = { createElement: () => null };
    RuntimeRegistryAccess.register('react', react);
    expect(RuntimeRegistryAccess.get('react')).toBe(react);
    expect(Object.getOwnPropertyNames(window).filter((name) => name.startsWith('__fromcode'))).toEqual(before);
  });

  it('reads what another framework bundle wrote to the shared host', async () => {
    await RuntimeRegistryAccess.connect();
    const host = await load(RuntimeHostModule.URL);
    // A second copy of core writes through the same host; this copy has no entry of its own for the key.
    expect(RuntimeRegistryAccess.get('other-bundle-only')).toBeUndefined();
    const before = document.readyState;
    Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' });
    try {
      host.claim()('other-bundle-only', 42);
    } finally {
      Object.defineProperty(document, 'readyState', { configurable: true, get: () => before });
    }
    expect(RuntimeRegistryAccess.get('other-bundle-only')).toBe(42);
  });

  it('refuses a writer to anyone once the document has loaded', async () => {
    await RuntimeRegistryAccess.connect();
    const host = await load(RuntimeHostModule.URL);
    expect(document.readyState).toBe('complete');
    expect(host.claim()).toBeNull();
  });
});
