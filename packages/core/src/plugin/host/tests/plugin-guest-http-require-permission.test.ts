import { describe, expect, it } from 'vitest';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';

/**
 * A sandboxed plugin's `requirePermission` must judge the roles IN EFFECT for the request — a site's
 * membership roles, which the host forwarded on `req.user` — as the host's own guard does. It used to
 * ask for the account's GLOBAL permissions, so a site administrator who is a customer everywhere else
 * was refused, and a `<prefix>:*` grant never matched.
 */
describe('PluginGuestHttp.requirePermission', () => {
  const run = async (user: Record<string, unknown>, required: string, rolePermissions: Record<string, string[]>) => {
    const calls: unknown[] = [];
    const http = Object.create(PluginGuestHttp.prototype) as any;
    http.remote = {
      call: async (_kind: string, path: Array<{ name: string; args?: unknown[] }>) => {
        calls.push(path);
        const roles = (path[1].args?.[0] ?? []) as string[];
        return roles.flatMap((role) => rolePermissions[role] ?? []);
      },
    };
    let status = 0;
    let passed = false;
    const res = { status(code: number) { status = code; return this; }, json() { return this; } };
    await http.requirePermission(required)({ user }, res, () => { passed = true; });
    return { passed, status, calls };
  };

  it('resolves from the request roles, not the account', async () => {
    const result = await run({ id: 7, roles: ['shop-staff'] }, 'shop:own', { 'shop-staff': ['shop:own'] });
    expect(result.passed).toBe(true);
    expect(result.calls).toEqual([[{ name: 'auth' }, { name: 'getPermissionsForRoles', args: [['shop-staff']] }]]);
  });

  it('a prefix wildcard covers the permission', async () => {
    expect((await run({ id: 7, roles: ['manager'] }, 'shop:own', { manager: ['shop:*'] })).passed).toBe(true);
  });

  it('refuses a role without the permission', async () => {
    const result = await run({ id: 7, roles: ['customer'] }, 'shop:own', { customer: [] });
    expect(result.passed).toBe(false);
    expect(result.status).toBe(403);
  });
});
