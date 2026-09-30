import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IDatabaseManager } from '@fromcode119/database';
import { TenantArchiveSource } from '@core/tenant/provisioning/tenant-archive-source';
import { TenantArchiveWriter } from '@core/tenant/provisioning/tenant-archive-writer';
import { TenantEraser } from '@core/tenant/provisioning/tenant-eraser';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';
import { TenantImportFiles } from '@core/tenant/provisioning/tenant-import-files';
import { TenantRowInserter } from '@core/tenant/provisioning/tenant-row-inserter';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * A site's files live in `<uploads>/tenants/<site>/`, and `/uploads` serves from there before the
 * shared root. Export and delete read the shared root alone, so an exported site arrived without a
 * single file uploaded inside it, and a deleted site left all of those files behind.
 */

let root: string;
const write = (dir: string, name: string, body: string) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), body);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-uploads-'));
  write(path.join(root, 'tenants', 'shop'), 'photo.png', 'SITE');
  write(path.join(root, 'tenants', 'shop'), 'same.png', 'SITE-COPY');
  write(path.join(root, 'tenants', 'other'), 'theirs.png', 'OTHER');
  write(root, 'legacy.png', 'OLD');
  write(root, 'same.png', 'ROOT-COPY');
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('exporting a site copies its own uploads', () => {
  it('copies the site directory and the shared root, never another site, and the site copy wins', () => {
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'site-export-'));
    fs.mkdirSync(path.join(staging, 'files'));
    const writer = new TenantArchiveWriter(TenantArchiveSource.tenant({} as IDatabaseManager, 'shop', root), []);
    const warnings: string[] = [];

    const copied = (writer as any).copyFiles(new Set(['photo.png', 'legacy.png']), staging, warnings);

    const files = fs.readdirSync(path.join(staging, 'files')).sort();
    expect(files).toEqual(['legacy.png', 'photo.png', 'same.png']);
    expect(fs.readFileSync(path.join(staging, 'files', 'same.png'), 'utf8')).toBe('SITE-COPY');
    expect(copied.count).toBe(3);
    expect(warnings).toEqual([]);
    fs.rmSync(staging, { recursive: true, force: true });
  });
});

describe('deleting a site removes its own uploads', () => {
  it('removes the site directory and only the shared files its rows named', () => {
    const eraser = new TenantEraser({} as IDatabaseManager, {} as any, [], root);

    const removed = (eraser as any).removeFiles('shop', ['/uploads/legacy.png', '/uploads/photo.png']);

    expect(fs.existsSync(path.join(root, 'tenants', 'shop'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'legacy.png'))).toBe(false);
    // Another site's files, and a root file whose name the site's own copy shadowed, stay.
    expect(fs.existsSync(path.join(root, 'tenants', 'other', 'theirs.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'same.png'))).toBe(true);
    expect(removed).toBe(3);
  });
});

describe('restoring into a deployment with no sites', () => {
  it('updates a setting the deployment already has instead of failing on its key', async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const db = { queryRaw: vi.fn(async (sql: string, params: unknown[] = []) => { statements.push({ sql, params }); return []; }) } as unknown as IDatabaseManager;
    const meta = new TenantTableDescriptor('_system_meta', { key: 'text', value: 'text', tenant_id: 'text' }, false, null, [], new Set(), null, null, false, ['key']);
    const inserter = new TenantRowInserter(db, meta, null, new TenantIdRemap(), new TenantImportFiles(root), []);

    await inserter.insert({ key: 'timezone', value: 'Europe/Sofia', tenant_id: 'shop' });

    expect(statements[0].sql).toContain('ON CONFLICT ("key", "tenant_id") DO UPDATE SET "value" = EXCLUDED."value"');
    expect(statements[0].params).toContain(null);
    expect(statements[0].params).not.toContain('shop');
  });
});
