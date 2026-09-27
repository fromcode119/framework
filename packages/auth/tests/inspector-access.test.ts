import { describe, expect, it } from 'vitest';
import { AuthManager, InspectorAccess } from '@fromcode119/auth';

/**
 * The read-only inspector: reads everything an administrator reads, writes nothing. Checked through the
 * real request gate, with a real session token.
 */
async function run(roles: string[], method: string, path: string) {
  const auth = new AuthManager('test-secret-123');
  const token = await auth.generateToken({ id: '7', email: 'inspector@nra.test', roles } as any);
  const req: any = { method, path, url: path, headers: { cookie: `fc_token=${token}`, 'x-framework-client': 'admin-ui' }, cookies: {}, get: () => '' };
  const res: any = { statusCode: 200, body: null, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
  let passed = false;
  await auth.middleware()(req, res, () => { passed = true; });
  return { passed, status: res.statusCode, body: res.body, user: req.user };
}

describe('the read-only inspector', () => {
  it('reads as an administrator, marked read-only', async () => {
    const result = await run(['inspector'], 'GET', '/api/v1/plugins/books/entries');
    expect(result.passed).toBe(true);
    expect(result.user.roles).toEqual(['inspector', 'admin']);
    expect(result.user.readOnly).toBe(true);
  });

  it('is refused every write, whatever the route', async () => {
    for (const [method, path] of [['POST', '/api/v1/collections/fcp_books_entries'], ['PUT', '/api/v1/collections/fcp_books_entries/377'], ['PATCH', '/api/v1/plugins/shop/orders/1'], ['DELETE', '/api/v1/collections/users/2'], ['POST', '/api/v1/auth/verify-password']]) {
      const result = await run(['inspector'], method, path);
      expect([method, path, result.passed, result.status, result.body?.error]).toEqual([method, path, false, 403, 'read_only_inspector']);
    }
  });

  it('may still sign in and out, choose the site and pass the second factor', async () => {
    for (const path of ['/api/v1/auth/login', '/api/v1/auth/logout', '/api/v1/auth/sso/login', '/api/v1/auth/tenants/select', '/api/v1/auth/2fa/verify']) {
      const result = await run(['inspector'], 'POST', path);
      expect([path, result.passed]).toEqual([path, true]);
      // A write never carries the read grant.
      expect(result.user.roles).toEqual(['inspector']);
    }
  });

  it('cannot download a full backup or a plugin settings export', async () => {
    expect((await run(['inspector'], 'GET', '/api/v1/system/admin/backups/12/download')).status).toBe(403);
    expect((await run(['inspector'], 'GET', '/api/v1/plugins/books/settings/export')).status).toBe(403);
  });

  it('changes nothing for an administrator, even one who is also an inspector, or anyone else', async () => {
    const admin = await run(['admin', 'inspector'], 'POST', '/api/v1/collections/fcp_books_entries');
    expect([admin.passed, admin.user.roles, admin.user.readOnly]).toEqual([true, ['admin', 'inspector'], undefined]);
    const editor = await run(['editor'], 'POST', '/api/v1/collections/pages');
    expect([editor.passed, editor.user.roles]).toEqual([true, ['editor']]);
  });

  it('shows the admin client the administrator screens, marked read-only, without touching the token payload', () => {
    const stored = { id: '7', roles: ['inspector'], permissions: ['database:read'] };
    expect(InspectorAccess.presentToAdmin(stored)).toEqual({ id: '7', roles: ['inspector', 'admin'], permissions: ['*'], readOnly: true });
    expect(stored.roles).toEqual(['inspector']);
    expect(InspectorAccess.presentToAdmin({ roles: ['admin'], permissions: ['*'] })).toEqual({ roles: ['admin'], permissions: ['*'] });
  });
});
