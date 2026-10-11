import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IDatabaseManager } from '@fromcode119/database';
import { TenantEraser } from '@core/tenant/provisioning/tenant-eraser';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * Deleting a site took its memberships and left the accounts behind: a shop's customers, every person a
 * migration brought in, stayed on the platform with names and emails and no site at all. The accounts
 * that are the site's alone now go with it; the archive written first carries them.
 */

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-accounts-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const eraserWith = (accountIds: number[]) => {
  const statements: string[] = [];
  const db = {
    withTenant: vi.fn(async (_id: string, work: () => Promise<void>) => work()),
    queryRaw: vi.fn(async (sql: string) => {
      statements.push(sql.replace(/\s+/g, ' ').trim());
      if (sql.includes('SELECT DISTINCT u.id')) return accountIds.map((id) => ({ id }));
      if (sql.includes('count(*)')) return [{ count: 1 }];
      return [];
    }),
  } as unknown as IDatabaseManager;
  const memberships = new TenantTableDescriptor('_system_tenant_memberships', { user_id: 'text', tenant_id: 'text' }, false, null, []);
  const registry = { remove: vi.fn(async () => undefined) };
  const archive = path.join(root, 'shop.tar.gz');
  fs.writeFileSync(archive, 'x');
  return { eraser: new TenantEraser(db, registry as any, [memberships], root), statements, archive };
};

describe('deleting a site', () => {
  it('finds its own accounts before its memberships go, and removes them in the same transaction', async () => {
    const { eraser, statements, archive } = eraserWith([7, 9]);

    const outcome = await eraser.erase({ id: 'shop', slug: 'shop' } as any, archive);

    const at = (text: string) => statements.findIndex((sql) => sql.includes(text));
    expect(at('SELECT DISTINCT u.id')).toBeLessThan(at('BEGIN'));
    expect(at('BEGIN')).toBeLessThan(at('DELETE FROM "_system_tenant_memberships"'));
    expect(at('DELETE FROM "_system_tenant_memberships"')).toBeLessThan(at('DELETE FROM "users"'));
    expect(at('DELETE FROM "users"')).toBeLessThan(at('COMMIT'));
    expect(outcome.accounts).toBe(2);
  });

  it('keeps accounts that belong to another site or to a platform admin', async () => {
    const { eraser, archive } = eraserWith([]);
    await eraser.erase({ id: 'shop', slug: 'shop' } as any, archive);
    const select = (eraser as any).db.queryRaw.mock.calls.map((call: unknown[]) => String(call[0])).find((sql: string) => sql.includes('SELECT DISTINCT u.id'));

    expect(select).toContain("m.state = 'active'");
    expect(select).toContain('is_platform_admin IS NOT TRUE');
    expect(select).toContain('o.tenant_id <> $1');
  });

  it('writes no account delete when the site has none of its own', async () => {
    const { eraser, statements, archive } = eraserWith([]);

    const outcome = await eraser.erase({ id: 'shop', slug: 'shop' } as any, archive);

    expect(statements.some((sql) => sql.includes('DELETE FROM "users"'))).toBe(false);
    expect(outcome.accounts).toBe(0);
  });
});
