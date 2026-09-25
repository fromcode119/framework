import { describe, expect, it, vi } from 'vitest';

const order: string[] = [];
vi.mock('@api/services/tenants/gateway-reload-client', () => ({
  GatewayReloadClient: class { async notify() { order.push('gateway'); return true; } },
}));

import { ServerSettingsService } from '@api/server/server-settings-service';
import { SystemConstants } from '@fromcode119/core';

/**
 * The gateway rebuilds its routing map from this process's settings map. Pushing it BEFORE the map was
 * refreshed made it fetch the old console address and keep it until its own TTL, so the operator who
 * had just saved a new host met `unknown_host`.
 */
class GatewayFixture {
  static service(): { service: ServerSettingsService; handlers: Array<(payload: unknown) => void> } {
    const db = {
      tableExists: async () => true,
      find: async () => { await new Promise((resolve) => setTimeout(resolve, 5)); order.push('refresh'); return []; },
    };
    const service = new ServerSettingsService(db, { set: async () => undefined } as any, new Map(), { debug() {}, warn() {}, error() {} } as any);
    const handlers: Array<(payload: unknown) => void> = [];
    service.subscribeToSettingsChanges({ on: (_event, handler) => { handlers.push(handler); } });
    return { service, handlers };
  }
}

describe('a saved host reaches the gateway after the settings map has it', () => {
  it('pushes the gateway only once the refresh has finished', async () => {
    order.length = 0;
    const { handlers } = GatewayFixture.service();

    handlers.forEach((handler) => handler({ keys: [SystemConstants.META_KEY.ADMIN_URL] }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(order).toEqual(['refresh', 'gateway']);
  });

  it('finishing setup reaches the gateway, whose map depends on setup mode', async () => {
    order.length = 0;
    const { handlers } = GatewayFixture.service();

    handlers.forEach((handler) => handler({ keys: [SystemConstants.META_KEY.SETUP_COMPLETED] }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(order).toEqual(['refresh', 'gateway']);
  });
});
