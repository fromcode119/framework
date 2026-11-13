import { describe, it, expect, beforeAll } from 'vitest';
import { ContextBridge } from '@fromcode119/react/context-bridge';
import { ThemeServerRegistry } from '@/lib/ssr/theme-server-registry';

/**
 * The regression this guards: the server bridge carried no locale, so `ContextBridge.locale()` was
 * empty during SSR. Plugins format money with it, so the server printed "63.00€" (Node's default
 * locale) and the browser re-rendered the same price as "63,00€" a moment after load.
 */
describe('ThemeServerRegistry.renderInLocale', () => {
  beforeAll(() => {
    ThemeServerRegistry.install(ContextBridge, {});
  });

  it('exposes the request locale through the bridge for exactly one render', () => {
    expect(ContextBridge.locale()).toBeUndefined();
    const seen = ThemeServerRegistry.renderInLocale('bg', () => ContextBridge.locale());
    expect(seen).toBe('bg');
    expect(ContextBridge.locale()).toBeUndefined();
  });

  it('formats a number the way the browser will for that locale', () => {
    const label = ThemeServerRegistry.renderInLocale('bg', () =>
      (63).toLocaleString(ContextBridge.locale() || undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    expect(label).toBe('63,00');
  });

  it('restores the previous locale when the render throws', () => {
    expect(() => ThemeServerRegistry.renderInLocale('en', () => { throw new Error('boom'); })).toThrow('boom');
    expect(ContextBridge.locale()).toBeUndefined();
  });
});
