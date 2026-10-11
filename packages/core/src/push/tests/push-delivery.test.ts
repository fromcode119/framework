import { createECDH, createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PushDelivery } from '@core/push/push-delivery';
import { PushSubscriptionStore } from '@core/push/push-subscription-store';
import { PushSurface } from '@core/push/enums/push-surface.enum';

/** A person's devices get the message, signed with the site's key; a device that is gone is forgotten. */
describe('push delivery', () => {
  class Db {
    rows: any[] = [];
    nextId = 1;
    private matches(row: any, where: any) { return Object.entries(where || {}).every(([k, v]) => row[k] === v); }
    async find(_t: string, opts: any) { return this.rows.filter((r) => this.matches(r, opts?.where)); }
    async findOne(_t: string, where: any) { return this.rows.find((r) => this.matches(r, where)) ?? null; }
    async insert(_t: string, data: any) { const row = { id: this.nextId++, ...data }; this.rows.push(row); return row; }
    async update(_t: string, where: any, data: any) { const row = this.rows.find((r) => this.matches(r, where)); if (row) Object.assign(row, data); return row; }
    async delete(_t: string, where: any) { this.rows = this.rows.filter((r) => !this.matches(r, where)); }
  }
  const meta = () => { const map = new Map<string, string>(); return { get: async (k: string) => map.get(k) ?? null, set: async (k: string, v: string) => { map.set(k, v); } } as any; };
  const browser = () => { const ecdh = createECDH('prime256v1'); ecdh.generateKeys(); return { endpoint: '', p256dh: ecdh.getPublicKey().toString('base64url'), auth: Buffer.alloc(16, 3).toString('base64url') }; };

  const setup = async (answers: number[]) => {
    const db = new Db();
    const store = new PushSubscriptionStore(db);
    await store.save(7, PushSurface.CONSOLE, { ...browser(), endpoint: 'https://push.example/a' }, 'Laptop');
    await store.save(7, PushSurface.STOREFRONT, { ...browser(), endpoint: 'https://push.example/b' }, 'Phone');
    await store.save(8, PushSurface.CONSOLE, { ...browser(), endpoint: 'https://push.example/c' }, 'Other person');
    const calls: Array<{ url: string; init: any }> = [];
    const fetcher = (async (url: string, init: any) => { calls.push({ url, init }); return new Response(null, { status: answers.shift() ?? 201 }); }) as any;
    return { db, calls, delivery: new PushDelivery(db, meta(), fetcher) };
  };

  it('sends to that person\'s devices on that surface only, signed so the push service can check it', async () => {
    const { calls, delivery } = await setup([201]);
    expect(await delivery.toPerson(7, { title: 'New order', link: '/orders/1' }, PushSurface.CONSOLE)).toBe(1);
    expect(calls.map((c) => c.url)).toEqual(['https://push.example/a']);
    const { headers, redirect } = calls[0].init;
    expect(redirect).toBe('error');
    expect(headers['Content-Encoding']).toBe('aes128gcm');
    const [, token, key] = /^vapid t=([^,]+), k=(.+)$/.exec(headers.Authorization)!;
    const [head, claims, signature] = token.split('.');
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toMatchObject({ aud: 'https://push.example' });
    const point = Buffer.from(key, 'base64url');
    const publicKey = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url') }, format: 'jwk' });
    expect(verify('sha256', Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'))).toBe(true);
  });

  it('keeps one key per site: the second message is signed by the same key the browser subscribed with', async () => {
    const { calls, delivery } = await setup([201, 201]);
    await delivery.toPerson(7, { title: 'One' }, PushSurface.CONSOLE);
    await delivery.toPerson(7, { title: 'Two' }, PushSurface.CONSOLE);
    const keyOf = (i: number) => /k=(.+)$/.exec(calls[i].init.headers.Authorization)![1];
    expect(keyOf(0)).toBe(keyOf(1));
  });

  it('forgets a device the push service no longer knows, and one that keeps failing', async () => {
    const { db, delivery } = await setup([410]);
    await delivery.toPerson(7, { title: 'Hi' }, PushSurface.CONSOLE);
    expect(db.rows.map((r) => r.endpoint)).toEqual(['https://push.example/b', 'https://push.example/c']);
    const failing = await setup(Array(PushSubscriptionStore.MAX_FAILURES).fill(500));
    for (let i = 0; i < PushSubscriptionStore.MAX_FAILURES; i++) await failing.delivery.toPerson(8, { title: 'Hi' });
    expect(failing.db.rows.map((r) => r.endpoint)).not.toContain('https://push.example/c');
  });

  it('never sends to a device whose address is not https', async () => {
    const { db, calls, delivery } = await setup([]);
    db.rows.push({ id: 99, user_id: 9, surface: 'console', endpoint: 'http://10.0.0.1/steal', ...browser(), failures: 0 });
    expect(await delivery.toPerson(9, { title: 'Hi' })).toBe(0);
    expect(calls).toEqual([]);
  });

  describe('the site\'s own app on a phone', () => {
    const appSetup = async (tickets: any[]) => {
      const db = new Db();
      const store = new PushSubscriptionStore(db);
      await store.save(7, PushSurface.STOREFRONT, { ...browser(), endpoint: 'https://push.example/b' }, 'Browser');
      await store.save(7, PushSurface.APP, { endpoint: 'ExponentPushToken[abcdefgh1234]', p256dh: '', auth: '' }, 'iPhone');
      const calls: Array<{ url: string; init: any }> = [];
      const fetcher = (async (url: string, init: any) => {
        calls.push({ url, init });
        if (!url.startsWith('https://exp.host/')) return new Response(null, { status: 201 });
        return new Response(JSON.stringify({ data: [tickets.shift()] }), { status: 200 });
      }) as any;
      return { db, calls, delivery: new PushDelivery(db, meta(), fetcher) };
    };

    it('reaches a customer on the storefront and in the app, the app through Expo with the link as data', async () => {
      const { calls, delivery } = await appSetup([{ status: 'ok', id: 't1' }]);
      expect(await delivery.toPerson(7, { title: 'Твоят ден', body: 'Личен ден 7', link: '/today' }, PushSurface.CUSTOMER)).toBe(2);
      const expo = calls.find((c) => c.url === 'https://exp.host/--/api/v2/push/send')!;
      expect(JSON.parse(expo.init.body)).toEqual([{ to: 'ExponentPushToken[abcdefgh1234]', title: 'Твоят ден', body: 'Личен ден 7', data: { link: '/today' }, sound: 'default' }]);
      expect(expo.init.redirect).toBe('error');
    });

    it('forgets an app token Expo reports as no longer registered', async () => {
      const { db, delivery } = await appSetup([{ status: 'error', details: { error: 'DeviceNotRegistered' } }]);
      expect(await delivery.toPerson(7, { title: 'Hi' }, PushSurface.APP)).toBe(0);
      expect(db.rows.map((r) => r.surface)).toEqual(['storefront']);
    });
  });
});
