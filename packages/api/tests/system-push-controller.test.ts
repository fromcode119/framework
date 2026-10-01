import { createECDH } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SystemPushController } from '@api/controllers/system/system-push-controller';

/** A device is added to, listed for and removed from the SIGNED-IN person only, and only an https endpoint is kept. */
describe('a person\'s push devices', () => {
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
  const respond = () => { const res: any = {}; res.status = (code: number) => { res.code = code; return res; }; res.json = (body: unknown) => { res.body = body; return res; }; return res; };
  const browserKey = () => { const ecdh = createECDH('prime256v1'); ecdh.generateKeys(); return ecdh.getPublicKey().toString('base64url'); };
  const subscription = (endpoint: string) => ({ endpoint, keys: { p256dh: browserKey(), auth: Buffer.alloc(16, 1).toString('base64url') } });
  const call = async (controller: SystemPushController, method: 'subscribe' | 'list' | 'unsubscribe', user: unknown, body: unknown = {}) => {
    const res = respond();
    await (controller as any)[method]({ user, body }, res);
    return res;
  };

  it('keeps a well-formed https subscription for the signed-in person, and lists it to them alone', async () => {
    const db = new Db();
    const controller = new SystemPushController({ db });
    expect((await call(controller, 'subscribe', { id: 3 }, { surface: 'storefront', subscription: subscription('https://fcm.googleapis.com/fcm/send/abc'), label: 'Chrome · Mac' })).code).toBe(201);
    expect((await call(controller, 'list', { id: 3 })).body.devices).toEqual([expect.objectContaining({ surface: 'storefront', label: 'Chrome · Mac' })]);
    expect((await call(controller, 'list', { id: 4 })).body.devices).toEqual([]);
  });

  it('refuses a plain-http or internal endpoint, malformed keys, an unknown surface, and anyone signed out', async () => {
    const controller = new SystemPushController({ db: new Db() });
    expect((await call(controller, 'subscribe', { id: 3 }, { surface: 'storefront', subscription: subscription('http://10.0.0.5/x') })).code).toBe(400);
    expect((await call(controller, 'subscribe', { id: 3 }, { surface: 'storefront', subscription: { endpoint: 'https://push.test/a', keys: { p256dh: 'short', auth: 'x' } } })).code).toBe(400);
    expect((await call(controller, 'subscribe', { id: 3 }, { surface: 'everywhere', subscription: subscription('https://push.test/a') })).code).toBe(400);
    expect((await call(controller, 'subscribe', null, { surface: 'storefront', subscription: subscription('https://push.test/a') })).code).toBe(401);
  });

  it('removes only the signed-in person\'s own device', async () => {
    const db = new Db();
    const controller = new SystemPushController({ db });
    await call(controller, 'subscribe', { id: 3 }, { surface: 'console', subscription: subscription('https://push.test/mine') });
    await call(controller, 'unsubscribe', { id: 4 }, { endpoint: 'https://push.test/mine' });
    expect(db.rows).toHaveLength(1);
    await call(controller, 'unsubscribe', { id: 3 }, { endpoint: 'https://push.test/mine' });
    expect(db.rows).toHaveLength(0);
  });
});
