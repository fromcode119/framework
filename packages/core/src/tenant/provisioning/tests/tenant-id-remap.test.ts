import { describe, expect, it } from 'vitest';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';
import { TenantArchiveManifest } from '@core/tenant/provisioning/tenant-archive-manifest';

describe('TenantIdRemap', () => {
  it('leaves values alone for tables that were not remapped, and unknown ids alone within remapped ones', () => {
    const remap = new TenantIdRemap();
    expect(remap.resolve('fcp_zeta_pages', 7)).toBe(7);
    remap.set('fcp_zeta_pages', 7, 108);
    remap.markRemapped('fcp_zeta_pages');
    expect(remap.resolve('fcp_zeta_pages', 7)).toBe(108);
    expect(remap.resolve('fcp_zeta_pages', 8)).toBe(8);
    expect(remap.resolve('fcp_zeta_pages', null)).toBeNull();
  });

  it('preserves the value TYPE it was given — a string id stays a string', () => {
    const remap = new TenantIdRemap();
    remap.set('users', '3', 41);
    expect(remap.resolve('users', '3')).toBe('41');
    expect(remap.resolve('users', 3)).toBe(41);
  });
});

describe('TenantArchiveManifest.from', () => {
  it('refuses a format this platform does not read, and an archive naming no tenant', () => {
    expect(() => TenantArchiveManifest.from({ formatVersion: 2, tenant: { slug: 'a' } })).toThrow(/format 2/);
    expect(() => TenantArchiveManifest.from({ formatVersion: 1, tenant: {} })).toThrow(/no tenant slug/);
  });

  it('round-trips through toJSON', () => {
    const manifest = new TenantArchiveManifest(1, '2026-09-05T00:00:00.000Z', '0.1.88', 'single-tenant',
      { id: 'v', slug: 'v', primaryHost: 'v.test', hostAliases: ['www.v.test'], state: 'active' },
      [{ slug: 'eta', version: '0.1.33' }], { slug: 'fromcode', version: '0.1.27', config: null },
      [{ name: 'fcp_zeta_pages', rows: 44, columns: ['id', 'title'], hasSerialId: true }], 28, { count: 19, bytes: 1000 }, []);
    const again = TenantArchiveManifest.from(JSON.parse(JSON.stringify(manifest.toJSON())));
    expect(again.tenant.slug).toBe('v');
    expect(again.source).toBe('single-tenant');
    expect(again.totalRows).toBe(44);
    expect(again.tableNames).toEqual(['fcp_zeta_pages']);
  });
});
