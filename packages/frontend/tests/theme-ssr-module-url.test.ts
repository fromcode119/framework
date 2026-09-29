import { describe, expect, it } from 'vitest';
import { ThemeSsrModuleUrl } from '@/lib/ssr/theme-ssr-module-url';

/**
 * A chunk importing its entry back must reach the SAME module the cache-busted entry started — a second
 * copy re-booted the theme and gave its overrides their own copy of every context.
 */
describe('ThemeSsrModuleUrl.carryCacheBuster', () => {
  const parent = 'file:///themes/demo/ui-ssr/checkout-flow.mjs?v=gen-3';

  it('gives a relative import the importer\'s cache buster', () => {
    expect(ThemeSsrModuleUrl.carryCacheBuster('./entry.mjs', 'file:///themes/demo/ui-ssr/entry.mjs', parent))
      .toBe('file:///themes/demo/ui-ssr/entry.mjs?v=gen-3');
  });

  it('leaves bare specifiers, busted targets and unbusted importers alone', () => {
    expect(ThemeSsrModuleUrl.carryCacheBuster('react', 'file:///app/node_modules/react/index.js', parent))
      .toBe('file:///app/node_modules/react/index.js');
    expect(ThemeSsrModuleUrl.carryCacheBuster('./entry.mjs', 'file:///themes/demo/ui-ssr/entry.mjs?v=gen-2', parent))
      .toBe('file:///themes/demo/ui-ssr/entry.mjs?v=gen-2');
    expect(ThemeSsrModuleUrl.carryCacheBuster('./entry.mjs', 'file:///themes/demo/ui-ssr/entry.mjs', 'file:///themes/demo/ui-ssr/a.mjs'))
      .toBe('file:///themes/demo/ui-ssr/entry.mjs');
  });
});
