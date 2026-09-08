// @vitest-environment jsdom
import { createElement } from 'react';
import { EditorSessionParams } from '@fromcode119/core/client';
import { ReactDomRoots } from '@fromcode119/reactor';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreBootRegistrationSeed } from '@fromcode119/react/context/pre-boot-registration-seed';
import { StorefrontContentContract } from '@/lib/storefront-content-contract';
import { FrontendRuntimeConfig } from '@/runtime/frontend-runtime-config';
import { StorefrontHydrationReason } from '@/runtime/storefront-hydration-reason';
import { StorefrontHydrator } from '@/runtime/storefront-hydrator';

/**
 * The hydrator's decision table, and its two mount paths against real React roots in jsdom: a matching
 * tree is adopted by `hydrateRoot`; a mismatching one is reported through `onRecoverableError` and the
 * page is re-mounted ONCE on the fallback path, from the markup as served — a second error never
 * starts a second fallback.
 */
class HydratorFixture {
  static readonly Layout = function DefaultLayout(): null { return null; };
  static readonly Blocks = function BlockFlow(): null { return null; };

  static config(overrides: Record<string, unknown> = {}): FrontendRuntimeConfig {
    return FrontendRuntimeConfig.fromJson({
      apiUrl: 'http://api.test',
      locale: 'en',
      content: { title: 'About', slug: 'about', content: '<p>x</p>' },
      ssrRendersContentSlot: false,
      pageKind: 'content',
      frontend: { activeTheme: { slug: 'demo', defaultLayout: 'DefaultLayout' }, plugins: [] },
      ...overrides,
    });
  }

  /** Registrations as the theme (+ optionally the cms plugin) would have queued them. */
  static registrations(args: { layout?: boolean; slot?: boolean } = { layout: true }): PreBootRegistrationSeed {
    const queue: Array<{ type: string; args: unknown[] }> = [];
    if (args.layout) queue.push({ type: 'theme', args: ['demo', { layouts: { DefaultLayout: HydratorFixture.Layout } }] });
    if (args.slot) queue.push({ type: 'slot', args: [StorefrontContentContract.DISPLAY_SLOT, HydratorFixture.Blocks, 'cms', 1] });
    return PreBootRegistrationSeed.fold(queue).seed;
  }

  static host(html = '<div class="a">hello</div>'): HTMLElement {
    const host = document.createElement('div');
    host.id = StorefrontHydrator.ROOT_ID;
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
  }

  static decide(args: { host?: HTMLElement | null; config?: FrontendRuntimeConfig; registrations?: PreBootRegistrationSeed; search?: string }): StorefrontHydrationReason {
    return StorefrontHydrator.decide({
      host: args.host === undefined ? HydratorFixture.host() : args.host,
      config: args.config ?? HydratorFixture.config(),
      registrations: args.registrations ?? HydratorFixture.registrations(),
      search: args.search ?? '',
    });
  }

  static async tick(ms = 20): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('StorefrontHydrator.decide — the decision table', () => {
  it('ready: markup, content, no recipe, no editor session, layout registered', () => {
    expect(HydratorFixture.decide({})).toBe(StorefrontHydrationReason.READY);
    expect(StorefrontHydrationReason.READY.hydrates).toBe(true);
    expect(StorefrontHydrationReason.READY.mode).toBe('hydrate');
  });

  it('no root element → fallback', () => {
    expect(HydratorFixture.decide({ host: null })).toBe(StorefrontHydrationReason.NO_ROOT);
  });

  it('no server markup → fallback', () => {
    expect(HydratorFixture.decide({ host: HydratorFixture.host('   ') })).toBe(StorefrontHydrationReason.NO_MARKUP);
  });

  it('no resolved content → fallback', () => {
    expect(HydratorFixture.decide({ config: HydratorFixture.config({ content: null }) })).toBe(StorefrontHydrationReason.NO_CONTENT);
    // A 404 document carries no content on purpose and still hydrates (its body is the NotFoundBody override chain).
    expect(HydratorFixture.decide({ config: HydratorFixture.config({ content: null, pageKind: 'not-found', notFoundPath: '/nope' }) }).hydrates).toBe(true);
  });

  it('a recipe page → fallback', () => {
    const config = HydratorFixture.config({ content: { title: 'Shop', slug: 'shop', recipe: 'ecommerce.store-index' } });
    expect(HydratorFixture.decide({ config })).toBe(StorefrontHydrationReason.RECIPE);
  });

  it('an editor session → fallback: the framework\'s `preview` and every param a plugin registered; unrelated or empty params do not count', () => {
    // The hydrator keeps no list of its own. Before any plugin registers, only the framework's marker counts…
    expect(EditorSessionParams.ownerOf('edit')).toBeNull();
    expect(HydratorFixture.decide({ search: `?${EditorSessionParams.PREVIEW}=1` })).toBe(StorefrontHydrationReason.EDITOR_SESSION);
    expect(HydratorFixture.decide({ search: '?edit=1' })).toBe(StorefrontHydrationReason.READY);
    // …and a plugin's registration (what the cms storefront bundle does at evaluation) is what adds the rest.
    EditorSessionParams.register('test-editor', ['edit', 'draft']);
    for (const name of EditorSessionParams.names()) {
      expect(HydratorFixture.decide({ search: `?${name}=1` })).toBe(StorefrontHydrationReason.EDITOR_SESSION);
    }
    expect(EditorSessionParams.names()).toEqual([EditorSessionParams.PREVIEW, 'edit', 'draft']);
    expect(HydratorFixture.decide({ search: '?utm_source=x&edit=' })).toBe(StorefrontHydrationReason.READY);
    expect(HydratorFixture.decide({ search: '?cms=1' })).toBe(StorefrontHydrationReason.READY);
  });

  it('the layout the server rendered with is not registered → fallback', () => {
    expect(HydratorFixture.decide({ registrations: HydratorFixture.registrations({ layout: false }) })).toBe(StorefrontHydrationReason.LAYOUT_NOT_REGISTERED);
    // The content names a layout the theme lacks, but the theme's declared default is there — that is
    // what the server fell back to, so the client can too.
    const config = HydratorFixture.config({ content: { title: 'A', slug: 'a', themeLayout: 'Missing', content: 'x' } });
    expect(HydratorFixture.decide({ config })).toBe(StorefrontHydrationReason.READY);
  });

  it('the server body came from a content slot nothing registered → fallback; registered → ready', () => {
    const config = HydratorFixture.config({ ssrRendersContentSlot: true });
    expect(HydratorFixture.decide({ config })).toBe(StorefrontHydrationReason.CONTENT_SLOT_MISSING);
    expect(HydratorFixture.decide({ config, registrations: HydratorFixture.registrations({ layout: true, slot: true }) })).toBe(StorefrontHydrationReason.READY);
  });
});

describe('StorefrontHydrator.mount', () => {
  it('hydrates a matching tree in place (hydrateRoot, never createRoot)', async () => {
    const hydrateRoot = vi.spyOn(ReactDomRoots, 'hydrateRoot');
    const createRoot = vi.spyOn(ReactDomRoots, 'createRoot');
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const host = HydratorFixture.host();
    const fallbackTree = vi.fn();

    const reason = new StorefrontHydrator({
      host, config: HydratorFixture.config(), registrations: HydratorFixture.registrations(), search: '',
      hydrateTree: createElement('div', { className: 'a' }, 'hello'),
      fallbackTree,
    }).mount();
    await HydratorFixture.tick();

    expect(reason).toBe(StorefrontHydrationReason.READY);
    expect(hydrateRoot).toHaveBeenCalledTimes(1);
    expect(createRoot).not.toHaveBeenCalled();
    expect(fallbackTree).not.toHaveBeenCalled();
    expect(host.innerHTML).toBe('<div class="a">hello</div>');
    expect(info).toHaveBeenCalledWith('[frontend] hydration mode=hydrate');
  });

  it('takes the fallback path straight away when the decision says so, with the markup as served', () => {
    const hydrateRoot = vi.spyOn(ReactDomRoots, 'hydrateRoot');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const host = HydratorFixture.host('<div class="a">served</div>');
    const fallbackTree = vi.fn((html: string) => createElement('div', { className: 'fallback' }, html));

    const reason = new StorefrontHydrator({
      host, config: HydratorFixture.config({ content: { title: 'Shop', slug: 'shop', recipe: 'x' } }),
      registrations: HydratorFixture.registrations(), search: '',
      hydrateTree: createElement('div'), fallbackTree,
    }).mount();

    expect(reason).toBe(StorefrontHydrationReason.RECIPE);
    expect(hydrateRoot).not.toHaveBeenCalled();
    expect(fallbackTree).toHaveBeenCalledWith('<div class="a">served</div>');
    expect(warn).toHaveBeenCalledWith('[frontend] hydration fallback: recipe');
  });

  it('a recoverable hydration error → the fallback path ONCE, from the served markup; a second error is only logged', async () => {
    const realHydrateRoot = ReactDomRoots.hydrateRoot;
    let onRecoverableError: ((error: unknown) => void) | undefined;
    vi.spyOn(ReactDomRoots, 'hydrateRoot').mockImplementation((container, tree, options) => {
      onRecoverableError = options?.onRecoverableError as (error: unknown) => void;
      return realHydrateRoot(container, tree, options);
    });
    const createRoot = vi.spyOn(ReactDomRoots, 'createRoot');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const host = HydratorFixture.host('<div class="a">served</div>');
    const fallbackTree = vi.fn((html: string) => createElement('div', { className: 'fallback' }, html));

    const hydrator = new StorefrontHydrator({
      host, config: HydratorFixture.config(), registrations: HydratorFixture.registrations(), search: '',
      // Text differs from the served markup: React recovers by client-rendering and reports it.
      hydrateTree: createElement('div', { className: 'a' }, 'changed'),
      fallbackTree,
    });
    expect(hydrator.mount()).toBe(StorefrontHydrationReason.READY);
    await HydratorFixture.tick(50);

    expect(onRecoverableError).toBeTypeOf('function');
    expect(hydrator.hasFallenBack).toBe(true);
    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(fallbackTree).toHaveBeenCalledTimes(1);
    expect(fallbackTree).toHaveBeenCalledWith('<div class="a">served</div>');
    expect(host.innerHTML).toBe('<div class="fallback">&lt;div class="a"&gt;served&lt;/div&gt;</div>');
    expect(warn.mock.calls.some(([message]) => String(message).startsWith('[frontend] hydration fallback: recoverable-error'))).toBe(true);

    // A later recoverable error must not start another fallback.
    onRecoverableError!(new Error('again'));
    await HydratorFixture.tick(20);
    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(fallbackTree).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls.some(([message]) => String(message).includes('after fallback (ignored)'))).toBe(true);
  });
});
