import { describe, expect, it } from 'vitest';
import { AuthManager } from '@fromcode119/auth';

/** An administrator on the storefront sees the site as a visitor; the console and the preview keep the role. */
async function signedIn(roles: string[], headers: Record<string, string>) {
  const auth = new AuthManager('test-secret-123');
  const token = await auth.generateToken({ id: '7', email: 'owner@shop.test', roles, permissions: ['content:read'] } as any);
  const fill = (value: string) => value.replace('TOKEN', token);
  const req: any = { method: 'GET', path: '/api/v1/system/resolve', url: '/api/v1/system/resolve', headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, fill(v)])), cookies: {}, get: () => '' };
  const res: any = { status() { return this; }, json() { return this; } };
  await auth.middleware()(req, res, () => undefined);
  return req.user;
}

describe('a storefront session', () => {
  it('reads as a visitor, an administrator included', async () => {
    const user = await signedIn(['admin', 'customer'], { cookie: 'userToken=TOKEN' });
    expect(user.roles).toEqual(['customer']);
    expect(user.permissions).toEqual([]);
  });

  it('leaves a customer as signed in', async () => {
    const user = await signedIn(['customer'], { cookie: 'userToken=TOKEN' });
    expect(user.roles).toEqual(['customer']);
  });

  it('keeps the administrator in the console and in the preview', async () => {
    expect((await signedIn(['admin'], { cookie: 'fc_token=TOKEN', 'x-framework-client': 'admin-ui' })).roles).toContain('admin');
    expect((await signedIn(['admin'], { authorization: 'Bearer TOKEN' })).roles).toContain('admin');
  });

  it('keeps the administrator for what a ?preview=1 page asks from the browser, on the same host only', async () => {
    const page = { cookie: 'userToken=TOKEN', host: 'shop.test' };
    expect((await signedIn(['admin'], { ...page, referer: 'https://shop.test/shop/x?preview=1' })).roles).toContain('admin');
    expect((await signedIn(['admin'], { ...page, referer: 'https://shop.test/shop/x' })).roles).not.toContain('admin');
    expect((await signedIn(['admin'], { ...page, referer: 'https://other.test/shop/x?preview=1' })).roles).not.toContain('admin');
  });
});
