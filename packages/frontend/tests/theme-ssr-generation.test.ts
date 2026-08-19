import { beforeAll, describe, expect, it } from 'vitest';
import { ThemeSsrGeneration } from '@/lib/ssr/theme-ssr-generation';
import { ThemeServerRegistry } from '@/lib/ssr/theme-server-registry';

/**
 * The regression this guards: a theme update installed in the admin did not reach the storefront.
 *
 * The SSR bundles were imported once per process and Node's ESM cache is keyed by URL, so the
 * frontend kept rendering the artifacts it loaded at boot — and when the artifact had not existed at
 * boot, kept rendering nothing at all. Only an SSH `docker restart` applied an update. The generation
 * signature is what detects the change, and the staged registry is what stops a half-imported world
 * from being served while the change is applied.
 */
describe('ThemeSsrGeneration', () => {
  const config = (themeVersion: string, plugins: Array<{ slug: string; version: string }>) => ({
    activeTheme: { slug: 'vselenskiportal88', version: themeVersion },
    plugins,
  });

  it('changes when the active theme version changes', () => {
    const before = ThemeSsrGeneration.from(config('1.0.433', []));
    const after = ThemeSsrGeneration.from(config('1.0.434', []));
    expect(after.matches(before)).toBe(false);
    expect(after.token).not.toBe(before.token);
  });

  it('changes when any active plugin version changes', () => {
    const before = ThemeSsrGeneration.from(config('1.0.434', [{ slug: 'cms', version: '2.0.0' }]));
    const after = ThemeSsrGeneration.from(config('1.0.434', [{ slug: 'cms', version: '2.0.1' }]));
    expect(after.matches(before)).toBe(false);
  });

  it('is stable across two reads of an unchanged install', () => {
    const plugins = [{ slug: 'cms', version: '2.0.0' }, { slug: 'ecommerce', version: '3.1.0' }];
    const first = ThemeSsrGeneration.from(config('1.0.434', plugins));
    const second = ThemeSsrGeneration.from(config('1.0.434', plugins));
    expect(second.matches(first)).toBe(true);
    expect(second.token).toBe(first.token);
  });

  it('ignores the order the api happened to list plugins in', () => {
    const ascending = ThemeSsrGeneration.from(config('1.0.434', [
      { slug: 'cms', version: '2.0.0' },
      { slug: 'ecommerce', version: '3.1.0' },
    ]));
    const reversed = ThemeSsrGeneration.from(config('1.0.434', [
      { slug: 'ecommerce', version: '3.1.0' },
      { slug: 'cms', version: '2.0.0' },
    ]));
    // Re-importing every bundle because the load order shifted would be pure churn.
    expect(reversed.matches(ascending)).toBe(true);
  });

  it('reports no theme slug when the config names none, so the render bails instead of guessing', () => {
    expect(ThemeSsrGeneration.from(null).themeSlug).toBe('');
    expect(ThemeSsrGeneration.from({}).themeSlug).toBe('');
  });
});

describe('ThemeServerRegistry generations', () => {
  // Installed ONCE, like the real process: the bridge is a singleton, so `install` is a no-op after
  // the first call and a per-test install would hand back an empty object.
  let bridge: Record<string, (...args: unknown[]) => unknown> = {};
  beforeAll(() => {
    ThemeServerRegistry.install({ install: (args: unknown) => { bridge = args as typeof bridge; } }, {});
  });

  it('keeps serving the published world while the next generation is still importing', async () => {
    const oldLayout = () => null;
    const live = ThemeServerRegistry.beginGeneration();
    bridge.registerTheme('demo', { layouts: { Main: oldLayout } });
    ThemeServerRegistry.publishGeneration(live);

    // A version change opens a staging generation; the imports register into it, not into the live one.
    const staged = ThemeServerRegistry.beginGeneration();
    expect(ThemeServerRegistry.layoutsFor('demo').Main).toBe(oldLayout);

    const newLayout = () => null;
    bridge.registerTheme('demo', { layouts: { Main: newLayout } });
    // Mid-rebuild a request still gets the COMPLETE previous theme, never an empty one.
    expect(ThemeServerRegistry.layoutsFor('demo').Main).toBe(oldLayout);

    await staged.warmOverrides();
    ThemeServerRegistry.publishGeneration(staged);
    expect(ThemeServerRegistry.layoutsFor('demo').Main).toBe(newLayout);
  });

  it('discards a failed generation rather than leaving the storefront with no theme', () => {
    const liveLayout = () => null;
    const live = ThemeServerRegistry.beginGeneration();
    bridge.registerTheme('demo', { layouts: { Main: liveLayout } });
    ThemeServerRegistry.publishGeneration(live);

    const doomed = ThemeServerRegistry.beginGeneration();
    ThemeServerRegistry.discardGeneration(doomed);

    expect(ThemeServerRegistry.layoutsFor('demo').Main).toBe(liveLayout);
  });

  it('lets a new generation replace an override of equal priority', () => {
    const first = () => null;
    const generationOne = ThemeServerRegistry.beginGeneration();
    bridge.registerSlotComponent('frontend.content.display', first, 'cms', 10);
    ThemeServerRegistry.publishGeneration(generationOne);

    const second = () => null;
    const generationTwo = ThemeServerRegistry.beginGeneration();
    bridge.registerSlotComponent('frontend.content.display', second, 'cms', 10);
    ThemeServerRegistry.publishGeneration(generationTwo);

    // Clearing in place is not enough on its own — an empty generation is what makes the NEW component
    // the only one registered. Re-registering into the old maps appended a duplicate instead.
    const slot = ThemeServerRegistry.slotMap()['frontend.content.display'];
    expect(slot).toHaveLength(1);
    expect(slot[0]).toEqual({ component: second, pluginSlug: 'cms', priority: 10 });
  });
});
