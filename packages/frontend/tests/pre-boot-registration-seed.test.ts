// @vitest-environment jsdom
import { act, createElement, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextProviderSlotRegistrationHooks } from '@fromcode119/react/context/context-provider-slot-registration-hooks';
import { FrontendI18nService } from '@fromcode119/react/context/frontend-i18n-service';
import { PreBootRegistrationSeed } from '@fromcode119/react/context/pre-boot-registration-seed';
import { RenderableContentTransformerRegistry } from '@fromcode119/react/renderable-content-transformer-registry';

/**
 * The seed folds the pre-boot queue into the SAME state the live registration hooks produce for the
 * same calls — asserted by replaying one queue through both and diffing the result. Anything the seed
 * cannot fold stays in the queue for the live bridge.
 */
class HookHost {
  static state: Record<string, unknown> = {};
  static registration: ReturnType<typeof ContextProviderSlotRegistrationHooks.useSlotRegistration> | null = null;

  /** A function component (tests are outside the class-only rule) running the real hooks. */
  static Component(): null {
    const [slots, setSlots] = useState<Record<string, any[]>>({});
    const [overrides, setOverrides] = useState<Record<string, any>>({});
    const [themeVariables, setThemeVariables] = useState<Record<string, string>>({});
    const [themeLayouts, setThemeLayouts] = useState<Record<string, any>>({});
    const [themeStyleVariants, setThemeStyleVariants] = useState<Record<string, any>>({});
    const [fieldComponents, setFieldComponents] = useState<Record<string, any>>({});
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [collections, setCollections] = useState<any[]>([]);
    const [plugins, setPlugins] = useState<any[]>([]);
    const [settings, setSettings] = useState<Record<string, any>>({});
    const registration = ContextProviderSlotRegistrationHooks.useSlotRegistration({
      setCollections, setFieldComponents, setMenuItems, setOverrides, setPlugins, setSettings,
      setSlots, setThemeLayouts, setThemeStyleVariants, setThemeVariables,
    });
    const latest = useRef(registration);
    latest.current = registration;
    HookHost.registration = registration;
    HookHost.state = { slots, overrides, themeVariables, themeLayouts, themeStyleVariants, fieldComponents, menuItems, collections, plugins, settings };
    return null;
  }

  static async mount(): Promise<() => void> {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => { root.render(createElement(HookHost.Component)); });
    return () => { act(() => root.unmount()); };
  }

  /** Replay queue items through the live hooks, as the bridge flush would. */
  static async replay(queue: Array<{ type: string; args: any[] }>): Promise<void> {
    const dispatch: Record<string, string> = {
      slot: 'registerSlotComponent', override: 'registerOverride', theme: 'registerTheme',
      field: 'registerFieldComponent', menuItem: 'registerMenuItem', collection: 'registerCollection',
      settings: 'registerSettings', plugins: 'registerPlugins',
    };
    await act(async () => {
      for (const item of queue) {
        const method = dispatch[item.type];
        if (method) (HookHost.registration as any)[method](...item.args);
      }
    });
  }
}

class Fixture {
  static readonly Layout = function DefaultLayout(): null { return null; };
  static readonly Other = function OtherLayout(): null { return null; };
  static readonly Blocks = function BlockFlow(): null { return null; };
  static readonly Footer = function FooterBlock(): null { return null; };
  static readonly Navbar = function Navbar(): null { return null; };
  static readonly LateNavbar = function LateNavbar(): null { return null; };
  static readonly Field = function ColorField(): null { return null; };
  static readonly transform = (content: unknown): unknown => content;

  /** The queue a theme + two plugin bundles would write when evaluated against the pre-boot bridge. */
  static queue(): Array<{ type: string; args: any[] }> {
    return [
      { type: 'theme', args: ['demo', {
        layouts: { DefaultLayout: Fixture.Layout, OtherLayout: Fixture.Other },
        variables: { accent: '#123456' },
        styleVariants: { dark: { bg: 'black' } },
        overrides: { 'frontend.layout.navbar': Fixture.Navbar },
      }] },
      { type: 'translations', args: [{ en: { theme: { hello: 'Hello' } }, bg: { theme: { hello: 'Здравей' } } }, 'theme'] },
      // A plugin's slot, with a module-namespace payload (`default`) and an explicit priority.
      { type: 'slot', args: ['frontend.content.display', { default: Fixture.Blocks }, 'cms', 1] },
      { type: 'slot', args: ['frontend.content.footer', Fixture.Footer, 'cms', 5] },
      // Registering the same component twice must not duplicate it.
      { type: 'slot', args: ['frontend.content.display', Fixture.Blocks, 'cms', 1] },
      // A lower-priority override of a name the theme already owns is ignored.
      { type: 'override', args: ['frontend.layout.navbar', Fixture.LateNavbar, 'cms', 1] },
      { type: 'translations', args: [{ en: { cms: { read: 'Read more' } } }] },
      { type: 'translations', args: [{ legacy: { flat: 'yes' } }] },
      { type: 'contentTransformer', args: ['pre-boot-seed-test', Fixture.transform, 3] },
      // Not seedable — must survive in the residual queue.
      { type: 'field', args: ['ColorField', Fixture.Field] },
      { type: 'menuItem', args: [{ pluginSlug: 'cms', path: '/x', priority: 1 }] },
    ];
  }
}

// React's `act()` warns unless the environment declares itself a test environment.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as any)._fromcodeQueue;
});

describe('PreBootRegistrationSeed', () => {
  it('folds the queue to exactly the state the live registration hooks produce', async () => {
    const unmount = await HookHost.mount();
    await HookHost.replay(Fixture.queue());
    const { seed } = PreBootRegistrationSeed.fold(Fixture.queue());

    expect(seed.slots).toEqual(HookHost.state.slots);
    expect(seed.overrides).toEqual(HookHost.state.overrides);
    expect(seed.themeLayouts).toEqual(HookHost.state.themeLayouts);
    expect(seed.themeStyleVariants).toEqual(HookHost.state.themeStyleVariants);
    expect(seed.themeVariables).toEqual(HookHost.state.themeVariables);

    // The concrete shape, so the equality above is not two empty objects agreeing.
    expect(Object.keys(seed.themeLayouts)).toEqual(['DefaultLayout', 'OtherLayout']);
    expect(seed.slots['frontend.content.display']).toEqual([{ component: Fixture.Blocks, pluginSlug: 'cms', priority: 1 }]);
    expect(seed.slots['frontend.content.footer']).toEqual([{ component: Fixture.Footer, pluginSlug: 'cms', priority: 5 }]);
    expect(seed.overrides['frontend.layout.navbar']).toEqual({ component: Fixture.Navbar, pluginSlug: 'demo', priority: 10 });
    unmount();
  });

  it('folds translations per layer exactly as the live registration does', () => {
    const { seed } = PreBootRegistrationSeed.fold(Fixture.queue());
    let plugin: Record<string, Record<string, any>> = {};
    plugin = FrontendI18nService.foldRegistration(plugin, { en: { cms: { read: 'Read more' } } });
    plugin = FrontendI18nService.foldRegistration(plugin, { legacy: { flat: 'yes' } });
    const theme = FrontendI18nService.foldRegistration({}, { en: { theme: { hello: 'Hello' } }, bg: { theme: { hello: 'Здравей' } } });
    expect(seed.registeredTranslations).toEqual(plugin);
    expect(seed.themeTranslations).toEqual(theme);
    expect(FrontendI18nService.resolveEffective({}, seed.registeredTranslations, 'bg', seed.themeTranslations)).toEqual({
      legacy: { flat: 'yes' }, theme: { hello: 'Здравей' },
    });
  });

  it('applies content transformers to their registry and leaves the unseedable items for the live flush', () => {
    const { residual } = PreBootRegistrationSeed.fold(Fixture.queue());
    expect(RenderableContentTransformerRegistry.has('pre-boot-seed-test')).toBe(true);
    expect(residual.map((item) => item.type)).toEqual(['field', 'menuItem']);
  });

  it('consumes the window queue and writes only the residual back', () => {
    (window as any)._fromcodeQueue = Fixture.queue();
    const seed = PreBootRegistrationSeed.consume(window as any);
    expect(Object.keys(seed.themeLayouts)).toEqual(['DefaultLayout', 'OtherLayout']);
    expect((window as any)._fromcodeQueue.map((item: { type: string }) => item.type)).toEqual(['field', 'menuItem']);

    (window as any)._fromcodeQueue = [{ type: 'theme', args: ['demo', { layouts: { A: Fixture.Layout } }] }];
    PreBootRegistrationSeed.consume(window as any);
    expect((window as any)._fromcodeQueue).toBeUndefined();

    expect(PreBootRegistrationSeed.consume(window as any).slots).toEqual({});
  });

  it('is empty when nothing was queued', () => {
    const seed = PreBootRegistrationSeed.empty();
    expect(seed.slots).toEqual({});
    expect(seed.overrides).toEqual({});
    expect(seed.themeLayouts).toEqual({});
    expect(seed.registeredTranslations).toEqual({});
    expect(seed.themeTranslations).toEqual({});
  });
});
