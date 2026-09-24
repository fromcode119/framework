import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RuntimeRegistryAccess } from '@core/runtime-registry-access';

/**
 * The JSX runtime a theme bundle receives on the App Router path (`/register` renders there).
 * `jsxs` used to be the same function as `jsx`, so every statically written multi-child element
 * arrived as an unkeyed `children` array and dev React logged "unique key" once per component type.
 */
describe('RuntimeRegistryAccess.jsxRuntimeFor', () => {
  const runtime = RuntimeRegistryAccess.jsxRuntimeFor(React);

  afterEach(() => vi.restoreAllMocks());

  const keyWarnings = (render: () => unknown): number => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render();
    return spy.mock.calls.filter((call) => String(call[0]).includes('unique "key"')).length;
  };

  it('asks no keys of statically written children (jsxs)', () => {
    const StaticCard = () => runtime.jsxs('div', { children: [runtime.jsx('h1', { children: 'Title' }), runtime.jsx('p', { children: 'Body' })] });
    let html = '';
    expect(keyWarnings(() => { html = renderToStaticMarkup(runtime.jsx(StaticCard, {})); })).toBe(0);
    expect(html).toBe('<div><h1>Title</h1><p>Body</p></div>');
  });

  it('treats jsxDEV children as static only when the compiler says so', () => {
    const DevStatic = () => runtime.jsxDEV('ul', { children: [runtime.jsxDEV('li', { children: 'a' }), runtime.jsxDEV('li', { children: 'b' })] }, undefined, true);
    expect(keyWarnings(() => renderToStaticMarkup(runtime.jsx(DevStatic, {})))).toBe(0);
  });

  it('still reports a real missing key in a mapped list (jsx)', () => {
    const MappedList = () => runtime.jsx('ul', { children: ['a', 'b'].map((item) => runtime.jsx('li', { children: item })) });
    expect(keyWarnings(() => renderToStaticMarkup(runtime.jsx(MappedList, {})))).toBeGreaterThan(0);
  });

  it('keeps the key argument', () => {
    expect(runtime.jsxs('div', { children: ['a', 'b'] }, 'k').key).toBe('k');
    expect(runtime.jsx('div', {}, 'j').key).toBe('j');
  });
});
