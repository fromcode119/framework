import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeBridge } from '@core/runtime-bridge';

describe('RuntimeBridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * INVERTED, and it is the regression guard for the bug it used to pin.
   *
   * It previously asserted that a browser on `admin.framework.local` resolves to
   * `api.framework.local` — the host-role swap. That swap is what put the console and the api on two
   * origins, and therefore two sessions: the cookie naming the current site is host-scoped, so the
   * api host answered "no site" while every write stayed bound to one. The console displayed
   * "Platform / No site" with nothing in any log to say why.
   *
   * A browser now gets its own origin, whatever a bridge value or the environment says.
   */
  it('gives the browser its own origin, ignoring an api-host bridge value', () => {
    // `EnvUtils.isServer()` keys off `document`, not `window` — stubbing only `window` leaves these
    // helpers on their SERVER branch, so the assertions could never hold.
    vi.stubGlobal('document', {});
    vi.stubGlobal('window', {
      location: { origin: 'http://admin.framework.local' },
      ATLANTIS_API_URL: 'http://api.framework.local',
    });

    expect(RuntimeBridge.resolveApiBaseUrl()).toBe('http://admin.framework.local');
  });

  it('still resolves the configured api url on the SERVER, which has no origin', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.framework.local');

    expect(RuntimeBridge.resolveApiBaseUrl()).toBe('http://api.framework.local');
  });

});
