import { describe, expect, it, vi } from 'vitest';
import { PluginHealthRouteHandler } from './plugin-health-route-handler';

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
      status: 'error',
      plugin: 'forms',
      version: '1.0.0',
      message: 'Database unreachable',
    }));
    expect(next).not.toHaveBeenCalled();
  });
});