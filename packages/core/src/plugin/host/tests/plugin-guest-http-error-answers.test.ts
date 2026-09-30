import { afterEach, describe, expect, it } from 'vitest';
import os from 'os';
import path from 'path';
import http from 'http';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';

/**
 * Express's own fallbacks answered a plugin's unknown route and a thrown handler in HTML — with the
 * stack trace wherever NODE_ENV was not `production`. Both answer in JSON now, and a 500 names nothing.
 */
describe('PluginGuestHttp error answers', () => {
  let guest: PluginGuestHttp | null = null;
  afterEach(async () => { await guest?.close(); guest = null; });

  const request = (socketPath: string, url: string) => new Promise<{ status: number; type: string; body: string }>((resolve, reject) => {
    const req = http.request({ socketPath, path: url, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, type: String(res.headers['content-type'] ?? ''), body }));
    });
    req.on('error', reject);
    req.end();
  });

  const start = async () => {
    const socketPath = path.join(os.tmpdir(), `fc-guest-err-${process.pid}-${Date.now()}.sock`);
    guest = new PluginGuestHttp(socketPath, {} as any);
    guest.app.get('/p/boom', () => { throw new Error('secret internal detail at /app/plugins/p/index.js'); });
    guest.app.get('/p/teapot', () => { throw Object.assign(new Error('not today'), { status: 418 }); });
    guest.app.get('/p/ok', (_req, res) => { res.json({ ok: true }); });
    await guest.listen();
    return socketPath;
  };

  it('a route registered after start still answers', async () => {
    const socketPath = await start();
    expect(await request(socketPath, '/p/ok')).toMatchObject({ status: 200, body: '{"ok":true}' });
  });

  it('an unknown route is a JSON 404', async () => {
    const socketPath = await start();
    const reply = await request(socketPath, '/p/missing');
    expect(reply.status).toBe(404);
    expect(reply.type).toContain('application/json');
    expect(reply.body).not.toContain('<');
  });

  it('a thrown handler is a generic JSON 500 without the message or stack', async () => {
    const socketPath = await start();
    const reply = await request(socketPath, '/p/boom');
    expect(reply.status).toBe(500);
    expect(reply.type).toContain('application/json');
    expect(reply.body).not.toContain('secret internal detail');
    expect(reply.body).not.toContain('/app/plugins');
  });

  it('a client status the handler chose is kept, with its message', async () => {
    const socketPath = await start();
    expect(await request(socketPath, '/p/teapot')).toMatchObject({ status: 418, body: '{"error":"not today"}' });
  });
});
