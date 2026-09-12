import { describe, expect, it } from 'vitest';
import { SiteFormValues } from '@/app/sites/site-form-values';

/**
 * What Adopt and Import actually send.
 *
 * `toIdentity()` omitted `kind`, and the server requires it — so both screens 400'd with
 * `Tenant kind "" must be "site" or "workspace"` however the operator filled the form. The Kind
 * dropdown was writing to state nothing submitted, which is invisible from the UI: the control
 * showed "Storefront site" the whole time and the payload carried nothing.
 */
describe('SiteFormValues.toIdentity — what adopt and import submit', () => {
  const site = (): SiteFormValues => SiteFormValues.empty()
    .with({ slug: 'base', id: 'base', primaryHost: 'base.staging.example.com' });

  it('carries the kind, because the server requires it', () => {
    expect(site().toIdentity().kind).toBe('site');
  });

  it('still carries the identity fields it always did', () => {
    const identity = site().toIdentity();

    expect(identity.slug).toBe('base');
    expect(identity.id).toBe('base');
    expect(identity.primaryHost).toBe('base.staging.example.com');
  });

  it('does not name an appearance for a site — the server refuses one that does', () => {
    expect('appearance' in site().toIdentity()).toBe(false);
  });

  it('names the appearance for a workspace, which is the one kind that has one', () => {
    const workspace = SiteFormValues.empty()
      .with({ slug: 'console', primaryHost: 'console.example.com', kind: 'workspace', appearance: 'hub' });

    expect(workspace.toIdentity().kind).toBe('workspace');
    expect(workspace.toIdentity().appearance).toBe('hub');
  });
});
