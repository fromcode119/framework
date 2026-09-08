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
    const before = ThemeSsrGeneration.from(config('1.0.434', [{ slug: 'zeta', version: '2.0.0' }]));
    const after = ThemeSsrGeneration.from(config('1.0.434', [{ slug: 'zeta', version: '2.0.1' }]));
    expect(after.matches(before)).toBe(false);
  });

  it('is stable across two reads of an unchanged install', () => {
    const plugins = [{ slug: 'zeta', version: '2.0.0' }, { slug: 'beta', version: '3.1.0' }];
    const first = ThemeSsrGeneration.from(config('1.0.434', plugins));
    const second = ThemeSsrGeneration.from(config('1.0.434', plugins));
    expect(second.matches(first)).toBe(true);
    expect(second.token).toBe(first.token);
  });

  it('ignores the order the api happened to list plugins in', () => {
    const ascending = ThemeSsrGeneration.from(config('1.0.434', [
      { slug: 'zeta', version: '2.0.0' },
      { slug: 'beta', version: '3.1.0' },
    ]));
    const reversed = ThemeSsrGeneration.from(config('1.0.434', [
      { slug: 'beta', version: '3.1.0' },
      { slug: 'zeta', version: '2.0.0' },
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

  it('keeps serving a published world while another generation is still importing', async () => {
    // Generations are keyed by SIGNATURE (theme@version + plugin versions). On a multi-tenant deployment
    // two sites on different themes are resident at once, so publishing a second world must never
    // touch the first — and a request mid-rebuild still gets the COMPLETE previous one, never an empty one.
    const oldLayout = () => null;
    const live = ThemeServerRegistry.beginGeneration();
    bridge.registerTheme('demo', { layouts: { Main: oldLayout } });
    ThemeServerRegistry.publishGeneration('theme:demo@1', live);

    const staged = ThemeServerRegistry.beginGeneration();
    expect(ThemeServerRegistry.layoutsFor('theme:demo@1', 'demo').Main).toBe(oldLayout);

    const newLayout = () => null;
    bridge.registerTheme('demo', { layouts: { Main: newLayout } });
    // Registrations land in staging, not in any published world.
    expect(ThemeServerRegistry.layoutsFor('theme:demo@1', 'demo').Main).toBe(oldLayout);
    expect(ThemeServerRegistry.layoutsFor('theme:demo@2', 'demo').Main).toBeUndefined();

    await staged.warmOverrides((component) => component);
    ThemeServerRegistry.publishGeneration('theme:demo@2', staged);
    expect(ThemeServerRegistry.layoutsFor('theme:demo@2', 'demo').Main).toBe(newLayout);
    // BOTH remain resident and distinct: that is what lets two sites render two themes in one process.
    expect(ThemeServerRegistry.layoutsFor('theme:demo@1', 'demo').Main).toBe(oldLayout);
    expect(ThemeServerRegistry.publishedSignatures()).toEqual(expect.arrayContaining(['theme:demo@1', 'theme:demo@2']));
  });

  it('answers EMPTY for a signature nobody built — never another generation\'s theme', () => {
    const layout = () => null;
    const built = ThemeServerRegistry.beginGeneration();
    bridge.registerTheme('demo', { layouts: { Main: layout } });
    ThemeServerRegistry.publishGeneration('theme:built@1', built);

    expect(ThemeServerRegistry.layoutsFor('theme:never-built@1', 'demo')).toEqual({});
    expect(ThemeServerRegistry.slotMap('theme:never-built@1')).toEqual({});
    expect(ThemeServerRegistry.hasGeneration('theme:never-built@1')).toBe(false);
  });

  it('discards a failed generation rather than leaving the storefront with no theme', () => {
    const liveLayout = () => null;
    const live = ThemeServerRegistry.beginGeneration();
    bridge.registerTheme('demo', { layouts: { Main: liveLayout } });
    ThemeServerRegistry.publishGeneration('theme:live@1', live);

    const doomed = ThemeServerRegistry.beginGeneration();
    ThemeServerRegistry.discardGeneration(doomed);

    expect(ThemeServerRegistry.layoutsFor('theme:live@1', 'demo').Main).toBe(liveLayout);
  });

  it('evicting a generation forgets it, and a rebuild republishes it under the same key', () => {
    const layout = () => null;
    const gen = ThemeServerRegistry.beginGeneration();
    bridge.registerTheme('demo', { layouts: { Main: layout } });
    ThemeServerRegistry.publishGeneration('theme:evict@1', gen);
    expect(ThemeServerRegistry.hasGeneration('theme:evict@1')).toBe(true);

    ThemeServerRegistry.evict('theme:evict@1');
    expect(ThemeServerRegistry.hasGeneration('theme:evict@1')).toBe(false);
    expect(ThemeServerRegistry.layoutsFor('theme:evict@1', 'demo')).toEqual({});

    const rebuilt = ThemeServerRegistry.beginGeneration();
    bridge.registerTheme('demo', { layouts: { Main: layout } });
    ThemeServerRegistry.publishGeneration('theme:evict@1', rebuilt);
    expect(ThemeServerRegistry.layoutsFor('theme:evict@1', 'demo').Main).toBe(layout);
  });

  it('lets a new generation replace an override of equal priority', () => {
    const first = () => null;
    const generationOne = ThemeServerRegistry.beginGeneration();
    bridge.registerSlotComponent('frontend.content.display', first, 'zeta', 10);
    ThemeServerRegistry.publishGeneration('theme:slots@1', generationOne);

    const second = () => null;
    const generationTwo = ThemeServerRegistry.beginGeneration();
    bridge.registerSlotComponent('frontend.content.display', second, 'zeta', 10);
    ThemeServerRegistry.publishGeneration('theme:slots@2', generationTwo);

    // An empty generation is what makes the NEW component the only one registered in ITS world;
    // re-registering into the old maps appended a duplicate instead. The old world keeps its own.
    const slot = ThemeServerRegistry.slotMap('theme:slots@2')['frontend.content.display'];
    expect(slot).toHaveLength(1);
    expect(slot[0]).toEqual({ component: second, pluginSlug: 'zeta', priority: 10 });
    expect(ThemeServerRegistry.slotMap('theme:slots@1')['frontend.content.display'][0]).toEqual({ component: first, pluginSlug: 'zeta', priority: 10 });
  });
});
