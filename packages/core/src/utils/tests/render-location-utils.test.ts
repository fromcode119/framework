import { describe, expect, it } from 'vitest';
import { RenderLocationUtils } from '@core/utils/render-location-utils';
import { AccountRouteUtils } from '@core/utils/account-route-utils';
import { RuntimeBridge } from '@core/runtime-bridge';

/**
 * A server render answers the location the browser will: the request path and origin of the render it is
 * inside, and nothing once it has finished — with nothing left on `globalThis` for a script to replace.
 */
describe('RenderLocationUtils on the server', () => {
  const at = { path: '/account/email-preferences', origin: 'https://shop.example', search: '' };

  it('reads the request path and origin of the render', () => {
    RenderLocationUtils.renderAt(at, () => {
      expect(RenderLocationUtils.pathname()).toBe('/account/email-preferences');
      expect(RenderLocationUtils.origin()).toBe('https://shop.example');
    });
  });

  it('gives the account section of the rendered page, as the browser would', () => {
    RenderLocationUtils.renderAt(at, () => expect(AccountRouteUtils.currentSection()).toBe('email-preferences'));
  });

  it('resolves the api base to the page origin during a render', () => {
    RenderLocationUtils.renderAt(at, () => expect(RuntimeBridge.resolveApiBaseUrl()).toBe('https://shop.example'));
  });

  it('restores the outer location after a nested render, even when it throws', () => {
    RenderLocationUtils.renderAt(at, () => {
      expect(() => RenderLocationUtils.renderAt({ path: '/other', origin: '', search: '' }, () => { throw new Error('x'); })).toThrow('x');
      expect(RenderLocationUtils.pathname()).toBe('/account/email-preferences');
    });
  });

  it('answers nothing outside a render, and publishes nothing globally', () => {
    RenderLocationUtils.renderAt(at, () => {
      expect(Object.keys(globalThis).filter((k) => k.startsWith('__FC_RENDER'))).toEqual([]);
    });
    expect(RenderLocationUtils.pathname()).toBe('');
    expect(AccountRouteUtils.currentSection()).toBe('');
  });
});
