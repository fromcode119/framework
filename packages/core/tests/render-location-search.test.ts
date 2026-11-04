import { describe, expect, it } from 'vitest';
import { RenderLocationUtils } from '@core/utils/render-location-utils';
import { BrowserStateClient } from '@core/clients/browser-state-client';

// A list filtered by the page address painted the unfiltered list on the server and the filtered one in the
// browser: the server render runs at the request's address, and both sides read it here.
describe('the page address query during a server render', () => {
  const at = { path: '/shop', origin: 'https://shop.example', search: '?category=kids&sort=price' };

  it('reads the query of the render', () => {
    RenderLocationUtils.renderAt(at, () => {
      expect(RenderLocationUtils.search()).toBe('?category=kids&sort=price');
      expect(new BrowserStateClient().readQueryParamFromWindow('category')).toBe('kids');
    });
  });

  it('is empty outside a render', () => {
    expect(RenderLocationUtils.search()).toBe('');
    expect(new BrowserStateClient().readQueryParamFromWindow('category')).toBe('');
  });
});
