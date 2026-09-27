import { afterEach, describe, expect, it } from 'vitest';
import { SiteRoleEditor } from '@core/plugin/context/site-role-editor';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';

/** A membership table of one site, enough for the editor's reads and writes. */
const fakeManager = (rows: Array<Record<string, unknown>>) => ({
  db: {
    findOne: async (_table: string, where: Record<string, unknown>) => rows.find((r) => r.user_id === where.user_id && r.tenant_id === where.tenant_id) ?? null,
    update: async (_table: string, where: Record<string, unknown>, data: Record<string, unknown>) => {
      const row = rows.find((r) => r.user_id === where.user_id && r.tenant_id === where.tenant_id);
      if (row) Object.assign(row, data);
      return row;
    },
    insert: async (_table: string, data: Record<string, unknown>) => { rows.push({ ...data }); return data; },
  },
}) as any;
const global = { assign: async () => undefined, remove: async () => undefined };
const inSite = <T>(work: () => Promise<T>) => RequestContextUtils.storage.run({ tenantId: 'shop' } as any, work);

describe('SiteRoleEditor', () => {
  afterEach(() => TenantMode.reset());

  it('adds a role beside the site roles the account already has, never replacing them', async () => {
    TenantMode.configure({ tenantCount: 1, dialect: 'postgres', isolationSupported: true });
    const rows = [{ user_id: '5', tenant_id: 'shop', roles: ['admin'], state: 'active' }];
    const editor = new SiteRoleEditor(fakeManager(rows), global);
    await inSite(() => editor.add(5, 'shop-staff'));
    expect(rows[0].roles).toEqual(['admin', 'shop-staff']);
    await inSite(() => editor.remove(5, 'shop-staff'));
    expect(rows[0].roles).toEqual(['admin']);
  });

  it('makes a non-member a member holding only that role', async () => {
    TenantMode.configure({ tenantCount: 1, dialect: 'postgres', isolationSupported: true });
    const rows: Array<Record<string, unknown>> = [];
    const editor = new SiteRoleEditor(fakeManager(rows), global);
    await inSite(() => editor.add(9, 'shop-staff'));
    expect(rows).toEqual([{ user_id: '9', tenant_id: 'shop', roles: ['shop-staff'], state: 'active' }]);
    expect(await inSite(() => editor.rolesOf(9))).toEqual(['shop-staff']);
  });
});
