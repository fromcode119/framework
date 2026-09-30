import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { TenantResolverService } from '@fromcode119/core';
import { ServerCorsSetup } from '@api/server/server-cors-setup';

/**
 * An origin that is on no allow-list and is no site of this platform is REFUSED: the response carries no
 * allow headers, so the browser blocks the call. It used to be answered with a 500 and an [ERROR] log
 * line (the origin callback was handed an Error), so any page could fill the error log at will.
 */
describe('ServerCorsSetup unknown origin', () => {
  afterEach(() => vi.restoreAllMocks());

  const app = () => {
    vi.spyOn(TenantResolverService, 'shared').mockReturnValue({ resolveByHost: async () => null } as any);
    const server = express();
    new ServerCorsSetup(server, new Map(), { error: vi.fn(), warn: vi.fn(), info: vi.fn() } as any, {}).setup();
    server.post('/api/v1/auth/login', (_req, res) => { res.json({ ok: true }); });
    server.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: error.message });
    });
    return server;
  };

  it('refuses a preflight from an unknown origin without an error', async () => {
    const res = await request(app())
      .options('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBeLessThan(500);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('grants nothing to an unknown origin on a real request either', async () => {
    const res = await request(app()).post('/api/v1/auth/login').set('Origin', 'https://evil.example');
    expect(res.status).toBeLessThan(500);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('still answers a same-origin request', async () => {
    const res = await request(app()).post('/api/v1/auth/login').set('Host', 'api.fromcode.test').set('Origin', 'https://api.fromcode.test');
    expect(res.status).toBe(200);
  });
});
