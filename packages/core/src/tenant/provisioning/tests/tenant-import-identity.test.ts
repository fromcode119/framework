import { describe, expect, it } from 'vitest';
import { TenantImportIdentity } from '@core/tenant/provisioning/tenant-import-identity';

/**
 * These rules are why this resolution is shared rather than copied.
 *
 * Two callers create a site from an archive — the Sites admin and the `tenant-import` CLI — and what
 * they are copying is a working shop: real customers in the rows, real payment credentials in the
 * settings. A second implementation that drifted on `environment` would put somebody's live data up
 * as the real thing because an argument was omitted.
 */
describe('TenantImportIdentity', () => {
  const archived = { slug: 'vsp88', primaryHost: 'vsp88.example', hostAliases: ['www.vsp88.example'] };

  it('arrives MUTED: non-production and private unless the operator says otherwise', () => {
    const identity = TenantImportIdentity.resolve(archived, {});

    expect(identity.environment.value).toBe('non-production');
    expect(String(identity.visibility)).not.toBe('public');
  });

  it('imports as the real thing only when asked explicitly', () => {
    const identity = TenantImportIdentity.resolve(archived, { environment: 'production', visibility: 'public' });

    expect(identity.environment.value).toBe('production');
    expect(String(identity.visibility)).toBe('public');
  });

  it('keeps the archive\'s own identity when nothing is overridden', () => {
    const identity = TenantImportIdentity.resolve(archived, {});

    expect(identity.slug).toBe('vsp88');
    expect(identity.primaryHost).toBe('vsp88.example');
    expect(identity.hostAliases).toEqual(['www.vsp88.example']);
  });

  it('lets an operator re-home the site without touching the archive', () => {
    const identity = TenantImportIdentity.resolve(archived, { slug: 'staging', primaryHost: 'staging.example' });

    expect(identity.slug).toBe('staging');
    expect(identity.primaryHost).toBe('staging.example');
  });

  it('treats an archive written before site kinds existed as a site', () => {
    // Pre-T6 archives carry no `kind`; they were all exported from storefronts.
    expect(TenantImportIdentity.resolve(archived, {}).kind.value).toBe('site');
  });
});
