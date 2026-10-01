import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PluginOwners, TenantResolverService } from '@fromcode119/core';
import { ServerCorsSetup } from '@api/server/server-cors-setup';

/**
 * A plugin WIDGET is a sandboxed frame, so it sends `Origin: null`. It may call its own plugin's routes —
 * without credentials — and nothing else. A `null` origin used to reach the allow-list's URL parser,
 * throw, and write an [ERROR] line per request.
 */
describe('ServerCorsSetup widget origin', () => {
  afterEach(() => { vi.restoreAllMocks(); PluginOwners.forget('box'); });

  const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
  const app = () => {
    vi.spyOn(TenantResolverService, 'shared').mockReturnValue({ resolveByHost: async () => null } as any);
    const server = express();
    new ServerCorsSetup(server, new Map(), logger as any, {}).setup();
    server.post('/api/v1/plugins/box/vote', (_req, res) => { res.json({ ok: true }); });
    server.post('/api/v1/auth/login', (_req, res) => { res.json({ ok: true }); });
    return server;
  };

  it('lets a site plugin\'s widget call its own routes, without credentials', async () => {
    PluginOwners.record('box', 'site-a');
    const preflight = await request(app()).options('/api/v1/plugins/box/vote').set('Origin', 'null').set('Access-Control-Request-Method', 'POST');
    expect(preflight.headers['access-control-allow-origin']).toBe('null');
    expect(preflight.headers['access-control-allow-credentials']).toBeUndefined();
    const call = await request(app()).post('/api/v1/plugins/box/vote').set('Origin', 'null');
    expect(call.headers['access-control-allow-origin']).toBe('null');
    expect(call.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('grants a null origin nothing else, and logs no error for it', async () => {
    logger.error.mockClear();
    for (const path of ['/api/v1/auth/login', '/api/v1/plugins/platform-one/x']) {
      const res = await request(app()).options(path).set('Origin', 'null').set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
    expect(logger.error).not.toHaveBeenCalled();
  });
});
