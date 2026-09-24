import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuildToolchain } from '@extension-builder/deps/build-toolchain';

/**
 * The `require` banner every plugin UI bundle carries. Its `jsxs` must spread static children as
 * varargs, like `RuntimeRegistryAccess.jsxRuntimeFor` — as one array, dev React warns on every
 * multi-child element as if it were an unkeyed list.
 */
describe('BuildToolchain.BROWSER_REQUIRE_SHIM jsx runtime', () => {
  afterEach(() => vi.restoreAllMocks());

  const loadRuntime = (): { jsx: any; jsxs: any; jsxDEV: any } => {
    const window = { React };
    return new Function('window', `${BuildToolchain.BROWSER_REQUIRE_SHIM} return require("react/jsx-runtime");`)(window);
  };

  const keyWarnings = (render: () => unknown): number => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render();
    return spy.mock.calls.filter((call) => String(call[0]).includes('unique "key"')).length;
  };

  it('asks no keys of statically written children', () => {
    const runtime = loadRuntime();
    const Card = () => runtime.jsxs('div', { children: [runtime.jsx('b', { children: 'x' }), runtime.jsx('i', { children: 'y' })] });
    let html = '';
    expect(keyWarnings(() => { html = renderToStaticMarkup(runtime.jsx(Card, {})); })).toBe(0);
    expect(html).toBe('<div><b>x</b><i>y</i></div>');
  });

  it('still reports a missing key in a mapped list', () => {
    const runtime = loadRuntime();
    const List = () => runtime.jsx('ul', { children: ['a', 'b'].map((item) => runtime.jsx('li', { children: item })) });
    expect(keyWarnings(() => renderToStaticMarkup(runtime.jsx(List, {})))).toBeGreaterThan(0);
  });

  it('keeps the key and honours jsxDEV static children', () => {
    const runtime = loadRuntime();
    expect(runtime.jsxs('div', { children: ['a', 'b'] }, 'k').key).toBe('k');
    const Dev = () => runtime.jsxDEV('p', { children: [runtime.jsxDEV('b', { children: '1' }), runtime.jsxDEV('i', { children: '2' })] }, undefined, true);
    expect(keyWarnings(() => renderToStaticMarkup(runtime.jsx(Dev, {})))).toBe(0);
  });
});
