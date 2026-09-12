import { describe, expect, it } from 'vitest';
import { TenantAdminController } from '@api/controllers/system/tenant-admin-controller';
import { TenantIdentity } from '@fromcode119/core';

/**
 * What adopt and import actually read off a request.
 *
 * The projection returned id, slug, primaryHost, hostAliases and state — dropping `kind`, which
 * `TenantIdentity` requires. So all three routes that use it (preview, execute, adopt) answered
 * `Tenant kind "" must be "site" or "workspace"` however the form was filled, and a deployment
 * could not be adopted from the admin at all. `create` passes the body straight through, which is
 * why creating a site worked and made this look like a form bug rather than a server one.
 */
describe('TenantAdminController.identity — the fields adopt and import read', () => {
  /** The method is private; these tests exercise it as the routes do. */
  const project = (body: Record<string, unknown>): Record<string, unknown> =>
    (TenantAdminController as unknown as { identity(b: Record<string, unknown>): Record<string, unknown> }).identity(body);

  const site = {
    slug: 'base', id: 'base', primaryHost: 'base.staging.example.com', hostAliases: [], kind: 'site',
  };

  it('carries the kind, so the identity can be built at all', () => {
    expect(project(site).kind).toBe('site');
  });

  it('produces an identity TenantIdentity accepts — the thing that was failing', () => {
    expect(() => TenantIdentity.from(project(site))).not.toThrow();
    expect(TenantIdentity.from(project(site)).kind.isWorkspace).toBe(false);
  });

  it('carries a workspace and its appearance', () => {
    const identity = TenantIdentity.from(project({
      slug: 'console', primaryHost: 'console.example.com', hostAliases: [], kind: 'workspace', appearance: 'hub',
    }));

    expect(identity.kind.isWorkspace).toBe(true);
    expect(identity.appearance).toBe('hub');
  });

  it('still reads the fields it always did', () => {
    const projected = project(site);

    expect(projected.slug).toBe('base');
    expect(projected.id).toBe('base');
    expect(projected.primaryHost).toBe('base.staging.example.com');
  });

  it('reads them from a nested `tenant` object too, as the import screens send', () => {
    expect(project({ tenant: site }).kind).toBe('site');
  });
});
