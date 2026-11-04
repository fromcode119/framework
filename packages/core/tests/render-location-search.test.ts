import { afterEach, describe, expect, it } from 'vitest';
import { RuntimeConstants } from '@core/constants/runtime.constants';
import { RenderLocationUtils } from '@core/utils/render-location-utils';
import { BrowserStateClient } from '@core/clients/browser-state-client';

// A list filtered by the page address painted the unfiltered list on the server and the filtered one in the
// browser: the server render now publishes the request's query, and both sides read it here.
describe('the page address query during a server render', () => {
  const key = RuntimeConstants.GLOBALS.RENDER_SEARCH;
  afterEach(() => { delete (globalThis as Record<string, unknown>)[key]; });

  it('reads the query the render published', () => {
    (globalThis as Record<string, unknown>)[key] = '?category=kids&sort=price';
    expect(RenderLocationUtils.search()).toBe('?category=kids&sort=price');
    expect(new BrowserStateClient().readQueryParamFromWindow('category')).toBe('kids');
  });

  it('is empty outside a render', () => {
    expect(RenderLocationUtils.search()).toBe('');
    expect(new BrowserStateClient().readQueryParamFromWindow('category')).toBe('');
  });
});
