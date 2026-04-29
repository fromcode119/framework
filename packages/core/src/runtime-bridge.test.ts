import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeBridge } from './runtime-bridge';

describe('RuntimeBridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes admin-host api bridge values back to the api host', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://admin.framework.local',
      },
      FROMCODE_API_URL: 'http://admin.framework.local',
    });

    expect(RuntimeBridge.resolveApiBaseUrl()).toBe('http://api.framework.local');
  });
});
