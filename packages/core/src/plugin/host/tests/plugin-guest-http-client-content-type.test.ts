import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';
import { PluginHostHttpProxy } from '@core/plugin/host/plugin-host-http-proxy';

/**
 * A sandboxed plugin sees the media type its CLIENT sent.
 *
 * The host parses a body once and forwards it re-serialised as JSON, writing `content-type:
 * application/json` for those bytes. A form post therefore reached the plugin looking exactly like a
 * JSON one, and a plugin whose contract answers 415 to anything but JSON could never refuse it.
 */
describe('the content type a sandboxed plugin sees', () => {
  const sockets: string[] = [];
  const closers: Array<() => Promise<void>> = [];
  const socket = (name: string): string => {
    const file = path.join(os.tmpdir(), `fc-${name}-${process.pid}-${Date.now()}-${sockets.length}.sock`);
    sockets.push(file);
    return file;
  };
  afterEach(async () => {
    for (const close of closers.splice(0)) await close();
    for (const file of sockets.splice(0)) fs.rmSync(file, { force: true });
  });

  const hostTo = async (): Promise<express.Express> => {
    const guestSocket = socket('guest');
    const guest = new PluginGuestHttp(guestSocket, {} as any);
    guest.app.post('/echo', (req: any, res) => res.json({
      type: req.headers['content-type'] ?? null,
      body: req.body,
      leaked: req.headers[PluginGuestHttp.HEADER_CLIENT_CONTENT_TYPE] ?? null,
    }));
    await guest.listen();
    closers.push(() => guest.close());

    const proxy = new PluginHostHttpProxy(guestSocket);
    const host = express();
    host.use(express.json(), express.urlencoded({ extended: true }));
    host.post('/echo', (req, res, next) => {
      void proxy.forward(req, res, next, { token: 't', tenantId: 'site', locale: 'en', siteLocale: 'en' }, 5000, () => undefined);
    });
    return host;
  };

  it('a form post arrives as a form post, with its fields parsed', async () => {
    const reply = await request(await hostTo()).post('/echo').type('form').send('a=1');
    expect(reply.body).toEqual({ type: 'application/x-www-form-urlencoded', body: { a: '1' }, leaked: null });
  });

  it('a JSON post is unchanged', async () => {
    const reply = await request(await hostTo()).post('/echo').set('Content-Type', 'application/json; charset=utf-8').send('{"a":1}');
    expect(reply.body).toEqual({ type: 'application/json; charset=utf-8', body: { a: 1 }, leaked: null });
  });

  it('a client cannot name the media type through the private header', async () => {
    const reply = await request(await hostTo()).post('/echo').type('form')
      .set(PluginGuestHttp.HEADER_CLIENT_CONTENT_TYPE, 'application/json').send('a=1');
    expect(reply.body.type).toBe('application/x-www-form-urlencoded');
  });
});
