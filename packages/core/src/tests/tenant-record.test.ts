import { describe, expect, it } from 'vitest';
import { TenantRecord } from '@core/tenant/tenant-record';

describe('TenantRecord', () => {
  it('hydrates from a database row', () => {
    const tenant = TenantRecord.from({
      id: 't1', slug: 'acme', primary_host: 'acme.test',
      host_aliases: ['www.acme.test'], state: 'active',
    });
    expect(tenant.id).toBe('t1');
    expect(tenant.slug).toBe('acme');
    expect(tenant.isActive).toBe(true);
  });

  it('parses hostAliases stored as a JSON string', () => {
    const tenant = TenantRecord.from({
      id: 't1', slug: 'acme', primary_host: 'acme.test',
      host_aliases: '["www.acme.test","acme.example"]', state: 'active',
    });
    expect(tenant.hostAliases).toEqual(['www.acme.test', 'acme.example']);
  });

  it('treats a missing or malformed alias list as empty, never as a wildcard', () => {
    expect(TenantRecord.from({ id: 't1', slug: 'a', primary_host: 'a.test', state: 'active' }).hostAliases)
      .toEqual([]);
    expect(TenantRecord.from({ id: 't1', slug: 'a', primary_host: 'a.test', host_aliases: 'not json', state: 'active' }).hostAliases)
      .toEqual([]);
    expect(TenantRecord.from({ id: 't1', slug: 'a', primary_host: 'a.test', host_aliases: '{"any":"thing"}', state: 'active' }).hostAliases)
      .toEqual([]);
  });

  it('lists primary host and aliases, lowercased and deduped', () => {
    const tenant = TenantRecord.from({
      id: 't1', slug: 'acme', primary_host: 'ACME.test',
      host_aliases: ['www.ACME.test', 'acme.test'], state: 'active',
    });
    expect(tenant.hosts()).toEqual(['acme.test', 'www.acme.test']);
  });

  it('is not active in any state other than active', () => {
    expect(TenantRecord.from({ id: 't1', slug: 'a', primary_host: 'a.test', state: 'suspended' }).isActive)
      .toBe(false);
    expect(TenantRecord.from({ id: 't1', slug: 'a', primary_host: 'a.test' }).isActive).toBe(false);
  });

  it('refuses a row with no id — an unidentified tenant must never become a usable record', () => {
    expect(() => TenantRecord.from({ slug: 'a', primary_host: 'a.test', state: 'active' })).toThrow(/id/i);
  });
});

describe('TenantRecord kind', () => {
  it('reads the kind and appearance, and treats a row from before migration 027 as the site it always was', () => {
    const workspace = TenantRecord.from({ id: 'n', slug: 'n', primary_host: 'n.test', host_aliases: '[]', state: 'active', kind: 'workspace', appearance: 'nexora' });
    expect(workspace.isWorkspace).toBe(true);
    expect(workspace.appearance).toBe('nexora');
    const legacy = TenantRecord.from({ id: 'a', slug: 'a', primary_host: 'a.test', host_aliases: '[]', state: 'active' });
    expect(legacy.isWorkspace).toBe(false);
    expect(legacy.appearance).toBe('');
  });
});
