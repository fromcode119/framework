import { describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import { RequestServerTiming } from '@core/context/request-server-timing';
import { CookieConstants } from '@core/constants/cookie.constants';

const request = (overrides: Record<string, unknown> = {}) => ({ method: 'GET', headers: {}, originalUrl: '/api/system/frontend', ...overrides }) as any;

describe('RequestServerTiming.allows — who is told', () => {
  it('tells an anonymous read of a public address', () => {
    expect(RequestServerTiming.allows(request())).toBe(true);
    expect(RequestServerTiming.allows(request({ method: 'HEAD' }))).toBe(true);
  });

  it('never tells a write', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(RequestServerTiming.allows(request({ method }))).toBe(false);
  });

  it('never tells a caller carrying credentials', () => {
    expect(RequestServerTiming.allows(request({ headers: { authorization: 'Bearer x' } }))).toBe(false);
    expect(RequestServerTiming.allows(request({ headers: { 'x-api-key': 'k' } }))).toBe(false);
    expect(RequestServerTiming.allows(request({ user: { id: 1 } }))).toBe(false);
    for (const name of [...CookieConstants.AUTH_COOKIES_TO_CLEAR, CookieConstants.SITE_PREVIEW]) {
      expect(RequestServerTiming.allows(request({ headers: { cookie: `other=1; ${name}=abc` } }))).toBe(false);
    }
  });

  it('tells a visitor whose cookies are not credentials', () => {
    expect(RequestServerTiming.allows(request({ headers: { cookie: 'consent=1; theme=dark' } }))).toBe(true);
  });

  it('never tells on the sign-in routes: the number of queries a login ran would say whether an account exists', () => {
    expect(RequestServerTiming.allows(request({ originalUrl: '/api/auth/login' }))).toBe(false);
    expect(RequestServerTiming.allows(request({ originalUrl: '/api/v1/auth/status?x=1' }))).toBe(false);
    expect(RequestServerTiming.allows(request({ originalUrl: '/api/auth' }))).toBe(false);
    expect(RequestServerTiming.allows(request({ originalUrl: '/api/authors' }))).toBe(true);
  });
});

describe('RequestServerTiming recording', () => {
  it('records nothing, and costs nothing, without an open request', async () => {
    RequestServerTiming.record('x', 5);
    expect(await RequestServerTiming.step('x', async () => 7)).toBe(7);
  });

  it('formats durations and the number of times a step ran, and drops names it will not carry', async () => {
    let header = '';
    await new Promise<void>((resolve) => RequestServerTiming.middleware()({ method: 'GET', headers: {}, originalUrl: '/' } as any, { writeHead() { return this; }, headersSent: false } as any, async () => {
      RequestServerTiming.record('scan', 4);
      RequestServerTiming.record('scan', 6);
      RequestServerTiming.record('Bad Name; injected="1"', 3);
      RequestServerTiming.record('slug-/shop/secret', 3);
      RequestServerTiming.record('negative', -1);
      RequestServerTiming.record('nan', Number.NaN);
      await RequestServerTiming.step('db', async () => 1);
      const recorder = (RequestServerTiming as any).storage.getStore();
      header = RequestServerTiming.format(recorder);
      resolve();
    }));
    expect(header).toMatch(/^scan;dur=10\.0;desc="2x", db;dur=\d+\.\d$/);
  });

  it('counts the time before the handler once, as api-pre', async () => {
    let names: string[] = [];
    await new Promise<void>((resolve) => RequestServerTiming.middleware()({ method: 'GET', headers: {}, originalUrl: '/' } as any, { writeHead() { return this; }, headersSent: false } as any, () => {
      RequestServerTiming.handlerReached();
      RequestServerTiming.handlerReached();
      names = [...(RequestServerTiming as any).storage.getStore().steps.keys()];
      resolve();
    }));
    expect(names).toEqual(['api-pre']);
  });
});

describe('RequestServerTiming over HTTP', () => {
  const serve = async (gated: boolean, handler: express.RequestHandler, pre?: express.RequestHandler) => {
    const app = express();
    if (pre) app.use(pre);
    app.use(RequestServerTiming.middleware({ gated }));
    app.use(handler);
    const server = app.listen(0);
    const port = (server.address() as AddressInfo).port;
    return { port, close: () => server.close() };
  };

  it('sets the header on an anonymous read and adds to one the handler already set', async () => {
    const { port, close } = await serve(true, (_req, res) => {
      RequestServerTiming.record('scan', 3);
      res.setHeader('Server-Timing', 'plugin-step;dur=1.0');
      res.json({ ok: true });
    });
    try {
      const reply = await fetch(`http://127.0.0.1:${port}/x`);
      expect(reply.headers.get('server-timing')).toMatch(/^plugin-step;dur=1\.0, scan;dur=3\.0$/);
    } finally { close(); }
  });

  it('removes timings a plugin process sent when the caller is not allowed to be told', async () => {
    const { port, close } = await serve(true, (_req, res) => {
      RequestServerTiming.record('scan', 3);
      res.setHeader('Server-Timing', 'plugin-step;dur=1.0');
      res.json({ ok: true });
    });
    try {
      for (const init of [{ method: 'POST' }, { headers: { authorization: 'Bearer x' } }, { headers: { cookie: `${CookieConstants.SITE_PREVIEW}=1` } }] as RequestInit[]) {
        const reply = await fetch(`http://127.0.0.1:${port}/x`, init);
        expect(reply.headers.get('server-timing')).toBeNull();
      }
    } finally { close(); }
  });

  it('an ungated recorder (a plugin process) always reports to the api that called it', async () => {
    const { port, close } = await serve(false, (_req, res) => { RequestServerTiming.record('plugin-handler', 2); res.json({ ok: true }); });
    try {
      const reply = await fetch(`http://127.0.0.1:${port}/x`, { method: 'POST' });
      expect(reply.headers.get('server-timing')).toMatch(/^plugin-handler;dur=2\.0$/);
    } finally { close(); }
  });

  it('survives a response that never had a handler step and a status written with headers', async () => {
    const { port, close } = await serve(true, (_req, res) => { res.writeHead(204, { 'X-A': '1' }); res.end(); });
    try {
      const reply = await fetch(`http://127.0.0.1:${port}/x`);
      expect(reply.status).toBe(204);
      expect(reply.headers.get('x-a')).toBe('1');
      expect(reply.headers.get('server-timing')).toBeNull();
    } finally { close(); }
  });
});
