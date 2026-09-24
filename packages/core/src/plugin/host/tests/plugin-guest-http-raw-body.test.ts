import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginGuestHttp } from '../plugin-guest-http';

/**
 * The guest keeps a webhook's original bytes whenever the host flags that it forwarded them untouched —
 * for a form as well as for JSON. A provider that signs a form post (myPOS) is otherwise unverifiable.
 */
describe('a sandboxed plugin receiving a forwarded webhook', () => {
  let guest: PluginGuestHttp | null = null;
  afterEach(async () => { await guest?.close(); guest = null; });

  const post = async (contentType: string, body: string, flagged: boolean) => {
    const socketPath = path.join(os.tmpdir(), `fc-guest-raw-${process.pid}-${Date.now()}.sock`);
    guest = new PluginGuestHttp(socketPath, {} as any);
    guest.app.post('/webhooks/provider', (req: any, res) => res.json({ raw: req.rawBody ? req.rawBody.toString('utf8') : null }));
    await guest.listen();
    const headers: Record<string, string> = { 'content-type': contentType, 'content-length': String(Buffer.byteLength(body)) };
    if (flagged) headers[PluginGuestHttp.HEADER_RAW_BODY] = '1';
    return new Promise<any>((resolve, reject) => {
      const request = http.request({ socketPath, method: 'POST', path: '/webhooks/provider', headers }, (reply) => {
        let text = '';
        reply.on('data', (chunk) => { text += chunk; });
        reply.on('end', () => resolve(JSON.parse(text)));
      });
      request.on('error', reject);
      request.end(body);
    });
  };

  it('keeps the bytes of a flagged FORM post', async () => {
    const body = 'IPCmethod=IPCPurchaseNotify&Amount=42.50&Signature=a%2Bb%3D';

    expect((await post('application/x-www-form-urlencoded', body, true)).raw).toBe(body);
  });

  it('keeps the bytes of a flagged JSON post, as before', async () => {
    expect((await post('application/json', '{ "id" : 1 }', true)).raw).toBe('{ "id" : 1 }');
  });

  it('keeps nothing when the host did not flag the request as a webhook', async () => {
    expect((await post('application/x-www-form-urlencoded', 'a=1', false)).raw).toBeNull();
  });
});
