import { describe, expect, it } from 'vitest';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';

describe('TenantIdentity', () => {
  it('derives the id from the slug and lowercases hosts', () => {
    const identity = TenantIdentity.from({ kind: 'site', slug: 'Acme', primaryHost: 'ACME.Example.COM', hostAliases: 'www.acme.example.com, shop.acme.example.com' });
    expect(identity.id).toBe('acme');
    expect(identity.slug).toBe('acme');
    expect(identity.primaryHost).toBe('acme.example.com');
    expect(identity.hostAliases).toEqual(['www.acme.example.com', 'shop.acme.example.com']);
    expect(identity.state).toBe('active');
  });

  it('refuses a host with a scheme, a path or a port — a routing key, not a URL', () => {
    expect(() => TenantIdentity.from({ kind: 'site', slug: 'a', primaryHost: 'https://acme.com' })).toThrow(/bare hostname/);
    expect(() => TenantIdentity.from({ kind: 'site', slug: 'a', primaryHost: 'acme.com/shop' })).toThrow(/bare hostname/);
    expect(() => TenantIdentity.from({ kind: 'site', slug: 'a', primaryHost: 'acme.com:8080' })).toThrow(/bare hostname/);
  });

  it('refuses an id that could not be a path segment', () => {
    expect(() => TenantIdentity.from({ kind: 'site', id: '../x', slug: 'a', primaryHost: 'a.test' })).toThrow(/path segment/);
  });

  it('drops an alias equal to the primary host and dedupes the rest', () => {
    const identity = TenantIdentity.from({ kind: 'site', slug: 'a', primaryHost: 'a.test', hostAliases: ['a.test', 'b.test', 'B.TEST'] });
    expect(identity.hostAliases).toEqual(['b.test']);
    expect(identity.hosts).toEqual(['a.test', 'b.test']);
  });

  it('accepts only the two operator states', () => {
    expect(TenantIdentity.from({ kind: 'site', slug: 'a', primaryHost: 'a.test', state: 'suspended' }).state).toBe('suspended');
    expect(() => TenantIdentity.from({ kind: 'site', slug: 'a', primaryHost: 'a.test', state: 'deleted' })).toThrow(/not one of/);
  });

  it('requires a kind: a tenant is a site or a workspace, never a guess', () => {
    expect(() => TenantIdentity.from({ slug: 'a', primaryHost: 'a.test' })).toThrow(/must be "site" or "workspace"/);
    expect(() => TenantIdentity.from({ slug: 'a', primaryHost: 'a.test', kind: 'shop' })).toThrow(/must be "site" or "workspace"/);
    expect(TenantIdentity.from({ slug: 'a', primaryHost: 'a.test', kind: 'Workspace' }).kind.isWorkspace).toBe(true);
  });

  it('a workspace names its appearance (default console = empty); a site has none', () => {
    expect(TenantIdentity.from({ slug: 'a', primaryHost: 'a.test', kind: 'workspace', appearance: 'Nexora' }).appearance).toBe('nexora');
    expect(TenantIdentity.from({ slug: 'a', primaryHost: 'a.test', kind: 'workspace', appearance: 'default' }).appearance).toBe('');
    expect(TenantIdentity.from({ slug: 'a', primaryHost: 'a.test', kind: 'workspace' }).appearance).toBe('');
    expect(() => TenantIdentity.from({ slug: 'a', primaryHost: 'a.test', kind: 'workspace', appearance: 'Bad Name' })).toThrow(/lowercase letters/);
    expect(() => TenantIdentity.from({ slug: 'a', primaryHost: 'a.test', kind: 'site', appearance: 'nexora' })).toThrow(/Only a workspace/);
  });
});
