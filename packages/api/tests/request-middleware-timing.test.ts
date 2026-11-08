import express from 'express';
import type { AddressInfo } from 'net';
import { RequestServerTiming } from '@fromcode119/core';
import { RequestMiddlewareTiming } from '@api/server/request-middleware-timing';

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** What each middleware spent is told by name and order; a router, an error handler and a quick one are not touched or named. */
describe('RequestMiddlewareTiming', () => {
  const serve = async () => {
    const app = express();
    app.use(RequestServerTiming.middleware({ gated: true, totalAs: 'api-total' }));
    RequestMiddlewareTiming.instrument(app);
    app.use((_req, _res, next) => next());
    app.use(async (_req, _res, next) => { await pause(25); next(); });
    const router = express.Router();
    router.get('/x', (_req, res) => res.json({ ok: true }));
    app.use('/api', router);
    app.use('/api', (_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(500).json({ failed: true }); });
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    return { server, port: (server.address() as AddressInfo).port };
  };

  it('names the middleware that took time, in mounting order, and leaves out one that took none', async () => {
    const { server, port } = await serve();
    try {
      const reply = await fetch(`http://127.0.0.1:${port}/api/x`);
      expect(reply.status).toBe(200);
      const header = String(reply.headers.get('server-timing'));
      expect(header).toMatch(/mw2;dur=\d/);
      expect(header).not.toMatch(/mw1;/);
      const slow = Number(/mw2;dur=([\d.]+)/.exec(header)?.[1]);
      expect(slow).toBeGreaterThanOrEqual(20);
    } finally { server.close(); }
  });

  it('still routes through a router and an error handler mounted as they were', async () => {
    const { server, port } = await serve();
    try {
      expect((await fetch(`http://127.0.0.1:${port}/api/x`)).status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${port}/api/missing`)).status).toBe(404);
    } finally { server.close(); }
  });
});
