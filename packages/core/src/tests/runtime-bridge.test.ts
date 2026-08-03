import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeBridge } from '@core/runtime-bridge';

describe('RuntimeBridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes admin-host api bridge values back to the api host', () => {
    // `EnvUtils.isServer()` keys off `document`, not `window` — stubbing only `window` left these
    // browser-path helpers on their SERVER branch, so the assertions could never hold.
    vi.stubGlobal('document', {});
    vi.stubGlobal('window', {
      location: {
        origin: 'http://admin.framework.local',
      },
      FROMCODE_API_URL: 'http://admin.framework.local',
    });

    expect(RuntimeBridge.resolveApiBaseUrl()).toBe('http://api.framework.local');
  });
});
