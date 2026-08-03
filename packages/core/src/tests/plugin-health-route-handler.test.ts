import { describe, expect, it, vi } from 'vitest';
import { PluginHealthRouteHandler } from '@core/plugin-health-route-handler';
import { PluginHealthStatus } from '@core/enums/plugin-health-status.enum';

describe('PluginHealthRouteHandler', () => {
  it('returns 503 when the probe reports an error state', async () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const next = vi.fn();
    const handler = PluginHealthRouteHandler.create({
      getPlugin: () => ({ slug: 'forms', version: '1.0.0' }),
      probe: () => ({ status: 'error', message: 'Database unreachable' }),
    });

    await handler({} as never, { status } as never, next);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      // The builder hydrates the probe's RAW status string into the enum (Enum.toJSON keeps the wire
      // shape as 'error'), so assert against the member, not the string.
      status: PluginHealthStatus.ERROR,
      plugin: 'forms',
      version: '1.0.0',
      message: 'Database unreachable',
    }));
    expect(next).not.toHaveBeenCalled();
  });
});