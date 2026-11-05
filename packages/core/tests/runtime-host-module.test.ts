// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { RuntimeHostModule } from '@core/constants/runtime-host-module.constants';
import { RuntimeRegistryAccess } from '@core/runtime-registry-access';

const load = (url: string) => import(/* @vite-ignore */ url);

describe('RuntimeHostModule — the runtime handoff as an ES module', () => {
  it('is one instance per url, and hands its writer out once', async () => {
    const a = await load(RuntimeHostModule.URL);
    const b = await load(RuntimeHostModule.URL);
    expect(a).toBe(b);

    // RuntimeRegistryAccess claims it first, as the framework boot does.
    const react = { createElement: () => null };
    RuntimeRegistryAccess.register('react', react);
    await RuntimeRegistryAccess.connect();
    expect(a.get('react')).toBe(react);
    expect(a.claim()).toBeNull();

    // Later framework writes reach the host (the pre-boot stub → the real bridge).
    const next = { createElement: () => null };
    RuntimeRegistryAccess.register('react', next);
    expect(a.get('react')).toBe(next);
  });

  it('feeds a generated module, which reads the host and never window', async () => {
    const bridge = { PagePrefetch: { get: () => 'payload' } };
    RuntimeRegistryAccess.register('@fromcode119/react', bridge);
    await RuntimeRegistryAccess.connect();

    const accessor = RuntimeRegistryAccess.accessorExpr('@fromcode119/react');
    expect(accessor).not.toContain('window');
    const body = `export const PagePrefetch = ${accessor} ? ${accessor}.PagePrefetch : undefined;`;
    const mod = await load(`data:text/javascript,${encodeURIComponent(RuntimeRegistryAccess.moduleSource(body))}`);
    expect(mod.PagePrefetch.get()).toBe('payload');
  });

  it('writes nothing to window', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(RuntimeHostModule.URL).toMatch(/^data:text\/javascript,/);
    expect(decodeURIComponent(RuntimeHostModule.URL)).not.toMatch(/window|globalThis|self\./);
  });

  it('names a static file that imports the host by the host itself', () => {
    // An immutable file importing the host must move to a new url with the host: a browser keeps the old
    // copy for a year, and that copy imports an older, empty host.
    expect(RuntimeHostModule.TAG).toMatch(/^[0-9a-z]+$/);
    expect(RuntimeHostModule.taggedFile('lucide-react')).toBe(`lucide-react.${RuntimeHostModule.TAG}.js`);
  });
});
