import { afterEach, describe, expect, it } from 'vitest';
import { RuntimeConstants } from '@core/constants/runtime.constants';
import { RenderLocationUtils } from '@core/utils/render-location-utils';
import { AccountRouteUtils } from '@core/utils/account-route-utils';
import { RuntimeBridge } from '@core/runtime-bridge';

/**
 * A server render answers the location the browser will: the request path and origin the renderer
 * publishes for its synchronous render, and nothing once it has finished.
 */
describe('RenderLocationUtils on the server', () => {
  const globals = globalThis as Record<string, unknown>;
  const { RENDER_PATH, RENDER_ORIGIN } = RuntimeConstants.GLOBALS;

  afterEach(() => {
    delete globals[RENDER_PATH];
    delete globals[RENDER_ORIGIN];
  });

  it('reads the published request path and origin', () => {
    globals[RENDER_PATH] = '/account/email-preferences';
    globals[RENDER_ORIGIN] = 'https://shop.example';
    expect(RenderLocationUtils.pathname()).toBe('/account/email-preferences');
    expect(RenderLocationUtils.origin()).toBe('https://shop.example');
  });

  it('gives the account section of the rendered page, as the browser would', () => {
    globals[RENDER_PATH] = '/account/email-preferences';
    expect(AccountRouteUtils.currentSection()).toBe('email-preferences');
  });

  it('resolves the api base to the page origin during a render', () => {
    globals[RENDER_ORIGIN] = 'https://shop.example';
    expect(RuntimeBridge.resolveApiBaseUrl()).toBe('https://shop.example');
  });

  it('answers nothing outside a render', () => {
    expect(RenderLocationUtils.pathname()).toBe('');
    expect(AccountRouteUtils.currentSection()).toBe('');
  });
});
