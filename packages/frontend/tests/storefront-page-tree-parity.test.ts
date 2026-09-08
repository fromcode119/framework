import React, { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SlotsContext } from '@fromcode119/react/context/slots-context';
import { OverridesContext } from '@fromcode119/react/context/overrides-context';
import { TranslationContext } from '@fromcode119/react/context/translation-context';
import { PluginStateContext } from '@fromcode119/react/context/plugin-state-context';
import { CollectionsContext } from '@fromcode119/react/context/collections-context';
import { MenuContext } from '@fromcode119/react/context/menu-context';
import { SettingsContext } from '@fromcode119/react/context/settings-context';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import { PluginRuntimeContext } from '@fromcode119/react/view/plugin-runtime-context.client';
import { AccountShell } from '@fromcode119/react/account-shell';
import { AccountShellImplementation } from '@fromcode119/react/account/account-shell-implementation';
import { Override } from '@fromcode119/react/view/override.client';
import { ThemeOverrideRegistrar } from '@fromcode119/react/theme-override-registrar';
import { ThemeServerRegistry } from '@/lib/ssr/theme-server-registry';
import { ThemeSsrContentTree } from '@/lib/ssr/theme-ssr-content-tree';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';
import { StorefrontContentContract } from '@/lib/storefront-content-contract';
import { StorefrontPageKind } from '@/runtime/storefront-page-kind';
import { StorefrontPageTree } from '@/runtime/view/storefront-page-tree.client';

/**
 * `StorefrontPageTree` is the browser twin of `ThemeSsrContentTree.build`: the SAME page body, so the
 * runtime can `hydrateRoot` the server markup in place. This renders both — the server construction with
 * the runtime React `ThemeSsrRuntime.load()` provides, the client class through `react-dom/server` — for
 * the same content fixtures and asserts byte-identical HTML. A difference here is a hydration mismatch
 * on every page.
 *
 * BOTH sides render with `renderToString`, the hydratable form: `renderToStaticMarkup` drops the
 * `<!-- -->` text separators and the `<!--$-->` Suspense markers, so it could match while hydration
 * failed. The two fixtures beyond the content tree — the `/account` shell and a lazily registered block
 * renderer — are exactly where the server tree used to have no Suspense boundary while the client tree
 * had one.
 */
class ParityFixture {
  static runtime: ThemeSsrRuntime;

  /** The wrappers the two routes render — read from the kinds the pages pass, not restated. */
  static readonly className = StorefrontPageKind.CONTENT.contentClassName;

  static readonly style = StorefrontPageKind.CONTENT.contentStyle as Record<string, string>;

  static readonly stringContent = { title: 'About', slug: 'about', content: '<p>Hello <b>world</b></p>' };

  static readonly blocksContent = { title: 'Home', slug: 'home', content: [{ type: 'hero', data: { title: 'Hi' } }] };

  static readonly recipeContent = { title: 'Shop', slug: 'shop', recipe: 'ecommerce.store-index', content: [] };

  static readonly emptyContent = { title: 'Blank', slug: 'blank', content: '' };

  static readonly accountContent = { title: 'Account', slug: 'account', content: '' };

  /** A content-slot component both worlds can render: it only uses the ONE shared React. */
  static readonly BlockFlow = function BlockFlow(props: { content?: unknown; entry?: { slug?: string } }): React.ReactElement {
    return createElement('section', { className: 'blocks', 'data-entry': props.entry?.slug }, JSON.stringify(props.content));
  };

  static server(content: unknown, style: Record<string, string> | null = ParityFixture.style): string {
    const tree = ThemeSsrContentTree.build({ runtime: ParityFixture.runtime, content, className: ParityFixture.className, style });
    return ParityFixture.runtime.renderToString(tree);
  }

  static client(content: unknown, style: Record<string, string> | null = ParityFixture.style): string {
    return renderToString(createElement(StorefrontPageTree, { content, className: ParityFixture.className, style }));
  }

  private static readonly slots = { [StorefrontContentContract.DISPLAY_SLOT]: [{ component: ParityFixture.BlockFlow, pluginSlug: 'cms', priority: 1 }] };

  /** Both sides with the content slot filled — each through ITS OWN `SlotsContext` (the one its `Slot` reads). */
  static serverWithSlot(content: unknown): string {
    const fc = ParityFixture.runtime.frameworkReact;
    const tree = ThemeSsrContentTree.build({ runtime: ParityFixture.runtime, content, className: ParityFixture.className, style: ParityFixture.style });
    return ParityFixture.runtime.renderToString(
      ParityFixture.runtime.react.createElement(fc.SlotsContext.Context.Provider, { value: ParityFixture.slots }, tree),
    );
  }

  static clientWithSlot(content: unknown): string {
    return renderToString(
      createElement(SlotsContext.Context.Provider, { value: ParityFixture.slots as never },
        createElement(StorefrontPageTree, { content, className: ParityFixture.className, style: ParityFixture.style })),
    );
  }

  /** Let a `React.lazy` a render just started loading settle, so the next render resolves it synchronously. */
  static settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * The provider stack a theme tree is rendered under — `ThemeSsrRuntime.provide` on the server, and its
 * mirror here for the client side, built from the SOURCE contexts the client tree reads. Same values on
 * both sides, so the only thing under test is the element shape.
 */
class ProviderFixture {
  private static readonly noop = () => undefined;

  private static readonly translation = {
    t: (key: string, _params?: Record<string, unknown>, defaultValue?: string) => defaultValue || key,
    locale: 'en',
    setLocale: ProviderFixture.noop,
  };

  static values(overrides: Record<string, unknown> = {}) {
    const context = { overrides, slots: {}, settings: {}, locale: 'en', api: null, t: ProviderFixture.translation.t };
    return {
      context,
      slots: {},
      overrides,
      translation: ProviderFixture.translation,
      settings: {},
      menuItems: [],
      collections: [],
      pluginState: { pluginState: {}, setPluginState: ProviderFixture.noop },
      pluginRuntime: {
        plugins: context,
        translation: ProviderFixture.translation,
        globalSettings: {},
        collections: [],
        locale: 'en',
        api: null,
      },
    };
  }

  static server(tree: unknown, overrides: Record<string, unknown> = {}): string {
    const runtime = ParityFixture.runtime;
    return runtime.renderToString(runtime.provide(tree, ProviderFixture.values(overrides)));
  }

  static client(tree: React.ReactNode, overrides: Record<string, unknown> = {}): string {
    const values = ProviderFixture.values(overrides);
    const wrap = (Context: { Context: { Provider: React.ComponentType<any> } }, value: unknown, child: React.ReactNode) =>
      createElement(Context.Context.Provider, { value }, child);
    const withPluginRuntime = createElement(PluginRuntimeContext.context.Provider, { value: values.pluginRuntime as never }, tree);
    return renderToString(
      wrap(SlotsContext, values.slots,
        wrap(OverridesContext, values.overrides,
          wrap(TranslationContext, values.translation,
            wrap(PluginStateContext, values.pluginState,
              wrap(CollectionsContext, values.collections,
                wrap(MenuContext, values.menuItems,
                  wrap(SettingsContext, values.settings,
                    createElement(PluginContextRegistry.Context.Provider, { value: values.context as never }, withPluginRuntime)))))))),
    );
  }
}

/** A block renderer registered LAZILY, the way `ThemeOverrideRegistrar.registerThemeBlockRenderers` does. */
class LazyBlockFixture {
  static readonly KEY = 'parity.block.hero';

  static readonly THEME = 'parity-theme';

  static readonly HeroRenderer = function HeroRenderer(props: { title?: string }): React.ReactElement {
    return createElement('section', { className: 'hero' }, props.title);
  };

  static loader(): Promise<{ default: React.ComponentType<any> }> {
    return Promise.resolve({ default: LazyBlockFixture.HeroRenderer });
  }

  /** The signature this fixture publishes its generation under — the registry is keyed per theme build. */
  static readonly SIGNATURE = 'parity-fixture';

  /** The server world: registered through the runtime's own registrar and bridge, warmed, published. */
  static async serverOverrides(): Promise<Record<string, unknown>> {
    const runtime = ParityFixture.runtime;
    ThemeServerRegistry.install(runtime.contextBridge, { getBaseUrl: () => '' });
    const state = ThemeServerRegistry.beginGeneration();
    runtime.frameworkReact.ThemeOverrideRegistrar.register({ [LazyBlockFixture.KEY]: LazyBlockFixture.loader }, LazyBlockFixture.THEME);
    await state.warmOverrides((component) => runtime.wrapOverride(component));
    ThemeServerRegistry.publishGeneration(LazyBlockFixture.SIGNATURE, state);
    return ThemeServerRegistry.overrideMap(LazyBlockFixture.SIGNATURE);
  }

  /** The browser world: what the registrar hands the reducer — the boundary around a `React.lazy`. */
  static clientOverrides(): Record<string, unknown> {
    return {
      [LazyBlockFixture.KEY]: {
        component: ThemeOverrideRegistrar.withSuspense(React.lazy(LazyBlockFixture.loader)),
        pluginSlug: LazyBlockFixture.THEME,
        priority: 11,
      },
    };
  }
}

beforeAll(async () => {
  ParityFixture.runtime = await ThemeSsrRuntime.load();
});

describe('StorefrontPageTree parity with ThemeSsrContentTree', () => {
  it('runs against the ONE React the server twin renders with', () => {
    // If these were two React copies the HTML could still match while hydration failed on the
    // dispatcher — the comparison below only means something when the instance is shared.
    expect(ParityFixture.runtime.react).toBe(React);
  });

  it('renders the hydratable form on both sides', () => {
    // `renderToString`, not static markup: a text-only tree shows the difference (`a<!-- -->b`).
    const html = ParityFixture.runtime.renderToString(createElement('p', null, 'a', 'b'));
    expect(html).toBe('<p>a<!-- -->b</p>');
    expect(renderToString(createElement('p', null, 'a', 'b'))).toBe(html);
  });

  it('string content — the stored-HTML prose body', () => {
    const html = ParityFixture.server(ParityFixture.stringContent);
    expect(html).toContain('<h1 class="text-4xl font-black mb-8">About</h1>');
    expect(html).toContain('<p>Hello <b>world</b></p>');
    expect(ParityFixture.client(ParityFixture.stringContent)).toBe(html);
  });

  it('blocks content — the slots only, no prose', () => {
    const html = ParityFixture.server(ParityFixture.blocksContent);
    expect(html).toBe('<div class="w-full" style="min-height:100svh"></div>');
    expect(ParityFixture.client(ParityFixture.blocksContent)).toBe(html);
  });

  it('blocks content with the content slot registered on both sides', () => {
    const html = ParityFixture.serverWithSlot(ParityFixture.blocksContent);
    expect(html).toContain('<section class="blocks" data-entry="home">');
    expect(html).toContain('hero');
    expect(ParityFixture.clientWithSlot(ParityFixture.blocksContent)).toBe(html);
  });

  it('recipe content — the empty, height-reserved box', () => {
    const html = ParityFixture.server(ParityFixture.recipeContent);
    expect(html).toBe('<div class="w-full" style="min-height:100svh"></div>');
    expect(ParityFixture.client(ParityFixture.recipeContent)).toBe(html);
  });

  it('empty content — the prose body with the display title', () => {
    const html = ParityFixture.server(ParityFixture.emptyContent);
    expect(html).toContain('<h1 class="text-4xl font-black mb-8">Blank</h1>');
    expect(ParityFixture.client(ParityFixture.emptyContent)).toBe(html);
  });

  it('the home wrapper (no reserved height) matches too', () => {
    expect(StorefrontPageKind.HOME.contentStyle).toBeNull();
    const html = ParityFixture.server(ParityFixture.stringContent, StorefrontPageKind.HOME.contentStyle);
    expect(html.startsWith('<div class="w-full">')).toBe(true);
    expect(ParityFixture.client(ParityFixture.stringContent, StorefrontPageKind.HOME.contentStyle)).toBe(html);
  });
});

describe('/account — the shell boundary is the same on both sides', () => {
  afterAll(() => {
    // The lazy swap below is what the browser bridge does; put the static implementation back.
    AccountShell.implementation.replace(AccountShellImplementation);
  });

  it('the server renders the real shell INSIDE a Suspense boundary, and the client matches byte for byte', () => {
    const fc = ParityFixture.runtime.frameworkReact;
    const page = ParityFixture.accountContent;
    const html = ProviderFixture.server(ParityFixture.runtime.react.createElement(fc.AccountShell, { page }));

    // The boundary markers wrap the whole shell — before Task 3 the server tree had none here.
    expect(html.startsWith('<!--$-->')).toBe(true);
    expect(html.endsWith('<!--/$-->')).toBe(true);
    // Server-side the auth gate is still deciding, so the shell's shape stands in — never a hole.
    expect(html).toContain('aria-busy="true"');

    expect(ProviderFixture.client(createElement(AccountShell, { page }))).toBe(html);
  });

  it('the client tree with the implementation code-split (React.lazy) produces the same bytes once loaded', async () => {
    const fc = ParityFixture.runtime.frameworkReact;
    const page = ParityFixture.accountContent;
    const html = ProviderFixture.server(ParityFixture.runtime.react.createElement(fc.AccountShell, { page }));

    AccountShell.implementation.replace(React.lazy(() => Promise.resolve({ default: AccountShellImplementation })));
    // First render starts the lazy load and emits the client-rendered fallback form.
    expect(ProviderFixture.client(createElement(AccountShell, { page }))).toContain('<!--$!-->');
    await ParityFixture.settle();
    // Loaded: the lazy resolves synchronously and the tree IS the server tree.
    expect(ProviderFixture.client(createElement(AccountShell, { page }))).toBe(html);
  });
});

describe('a lazily registered block renderer — the warmed override keeps its boundary', () => {
  it('server (warmed, re-wrapped) and client (React.lazy inside withSuspense) emit identical HTML', async () => {
    const serverOverrides = await LazyBlockFixture.serverOverrides();
    const fc = ParityFixture.runtime.frameworkReact;
    const props = { title: 'Hi' };
    const html = ProviderFixture.server(
      ParityFixture.runtime.react.createElement(fc.Override, { name: LazyBlockFixture.KEY, props }),
      serverOverrides,
    );

    expect(html).toBe('<!--$--><section class="hero">Hi</section><!--/$-->');

    const clientOverrides = LazyBlockFixture.clientOverrides();
    const tree = createElement(Override, { name: LazyBlockFixture.KEY, props });
    expect(ProviderFixture.client(tree, clientOverrides)).toContain('<!--$!-->');
    await ParityFixture.settle();
    expect(ProviderFixture.client(tree, clientOverrides)).toBe(html);
  });
});

describe('the 404 document — the override chain around NotFoundBody is the same on both sides', () => {
  const NotFoundOverride = function NotFoundOverride(props: { path?: string }): React.ReactElement {
    return createElement('section', { className: 'theme-404' }, `Missing: ${props.path}`);
  };
  const serverTree = (notFoundPath: string) => ThemeSsrContentTree.build({ runtime: ParityFixture.runtime, content: null, className: ParityFixture.className, style: ParityFixture.style, notFoundPath });
  const clientTree = (notFoundPath: string) => createElement(StorefrontPageTree, { content: null, className: ParityFixture.className, style: ParityFixture.style, notFoundPath });

  it('renders the framework NotFoundBody when no theme overrides the page, byte for byte', () => {
    const html = ProviderFixture.server(serverTree('/nope'));
    expect(html).toContain('Page not found');
    expect(html).toContain('href="/"');
    expect(ProviderFixture.client(clientTree('/nope'))).toBe(html);
  });

  it("renders the theme's frontend.page.404 override with the path, byte for byte", () => {
    const overrides = { 'frontend.page.404': { component: NotFoundOverride, pluginSlug: 'theme' } };
    const html = ProviderFixture.server(serverTree('/missing-page'), overrides);
    expect(html).toContain('<section class="theme-404">Missing: /missing-page</section>');
    expect(html).not.toContain('Page not found');
    expect(ProviderFixture.client(clientTree('/missing-page'), overrides)).toBe(html);
  });
});
