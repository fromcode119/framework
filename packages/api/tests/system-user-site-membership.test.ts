import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RequestContextUtils } from '@fromcode119/core';
import { SystemUserController } from '@api/controllers/system/system-user-controller';

/**
 * A user created while a site is selected must BELONG to that site.
 *
 * A site's users ARE its members — `TenantUserScope` filters every admin user surface by exactly the
 * membership this create never wrote. So the account did not appear on the Users page that had just
 * created it, a site administrator could neither see nor edit it, and it could hold no site-scoped
 * session. Only a platform admin, whose scope is unrestricted, could see it at all, which is why
 * creating a user LOOKED like it had worked.
 */
describe('creating a user attaches it to the selected site', () => {
  beforeEach(() => vi.restoreAllMocks());

  const controller = (rows: any[]) => {
    const runtime: any = {
      users: { saveUser: vi.fn(async () => 286) },
      db: {
        findOne: vi.fn(async () => null),
        find: vi.fn(async () => []),
        insert: vi.fn(async (table: string, data: any) => { rows.push({ table, data }); return data; }),
        update: vi.fn(async () => ({})),
      },
      isPlatformAdmin: vi.fn(async () => true),
    };
    return new SystemUserController(runtime);
  };

  const respond = () => {
    const res: any = { body: null, code: 200 };
    res.status = (c: number) => { res.code = c; return res; };
    res.json = (b: unknown) => { res.body = b; return res; };
    return res;
  };

  it('writes the membership, with the roles the operator chose', async () => {
    const rows: any[] = [];
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('fromcode');
    const res = respond();

    await controller(rows).saveUser({ params: {}, body: { email: 'a@b.test', roles: ['admin'] } } as any, res);

    expect(res.body).toMatchObject({ success: true, id: 286 });
    const membership = rows.find((row) => String(row.table).includes('membership'));
    expect(membership).toBeTruthy();
    expect(membership.data).toMatchObject({ user_id: '286', tenant_id: 'fromcode' });
    expect(String(membership.data.roles)).toContain('admin');
  });

  it('writes no membership in the platform scope, where there is no site to attach to', async () => {
    // Not a missing answer: an account created with no site selected is a platform-level account.
    const rows: any[] = [];
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(undefined as any);

    await controller(rows).saveUser({ params: {}, body: { email: 'a@b.test', roles: ['admin'] } } as any, respond());

    expect(rows.find((row) => String(row.table).includes('membership'))).toBeUndefined();
  });

  it('does not touch membership when EDITING an existing account', async () => {
    // Editing user 41 must never quietly move them into whichever site the admin is looking at.
    const rows: any[] = [];
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('fromcode');

    await controller(rows).saveUser({ params: { id: '41' }, body: { email: 'a@b.test', roles: ['admin'] } } as any, respond());

    expect(rows.find((row) => String(row.table).includes('membership'))).toBeUndefined();
  });
});
