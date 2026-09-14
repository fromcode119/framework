import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TenantEnvironmentGate } from '@core/tenant/tenant-environment-gate';
import { NonProductionRefusal } from '@core/tenant/non-production-refusal';
import { TenantEnvironment } from '@core/enums/tenant-environment.enum';
import { AuditOutcome } from '@core/security/enums/audit-outcome.enum';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * The brake that stops a copy of a live shop reaching real customers. Every path matters, and two of
 * them are the ones that would be got wrong by accident: no tenant must ALLOW (platform mail still has
 * to leave), and an unresolvable tenant must REFUSE (an id we cannot read is not evidence that sending
 * is safe).
 */
describe('TenantEnvironmentGate', () => {
  const db = {} as any;
  let audited: unknown[][];
  let audit: { logAction: (...args: unknown[]) => Promise<unknown> };

  const givenTenant = (record: unknown): void => {
    vi.spyOn(TenantResolverService, 'shared').mockReturnValue({
      resolveById: async () => record,
    } as any);
  };

  beforeEach(() => {
    audited = [];
    // A plain stub, not vi.fn(): a spy that THROWS fails the test even when the code catches it.
    audit = { logAction: async (...args: unknown[]) => { audited.push(args); return undefined; } };
  });

  afterEach(() => vi.restoreAllMocks());

  it('allows when there is no tenant — platform work is not a site', async () => {
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(undefined);

    await expect(new TenantEnvironmentGate(db, audit).assert('email', 'ops@example.com')).resolves.toBeUndefined();
    expect(audited).toEqual([]);
  });

  it('allows a production site', async () => {
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('acme');
    givenTenant({ id: 'acme', slug: 'acme', environment: TenantEnvironment.PRODUCTION });

    await expect(new TenantEnvironmentGate(db, audit).assert('network', 'https://api.stripe.com/v1/charges')).resolves.toBeUndefined();
    expect(audited).toEqual([]);
  });

  it('refuses a non-production site, names the control, and records the attempt', async () => {
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('sandbox');
    givenTenant({ id: 'sandbox', slug: 'vselenskiportal88', environment: TenantEnvironment.NON_PRODUCTION });

    const attempt = new TenantEnvironmentGate(db, audit).assert('email', 'real.customer@example.com', 'ecommerce');

    await expect(attempt).rejects.toBeInstanceOf(NonProductionRefusal);
    await attempt.catch((err: NonProductionRefusal) => {
      expect(err.effect).toBe('email');
      expect(err.target).toBe('real.customer@example.com');
      // The operator must be told which switch lifts this, not just that something was blocked.
      expect(err.message).toContain('Sites → vselenskiportal88 → Environment');
    });

    // "What would this have sent?" is the question after a test run, so the attempt is kept.
    // DENIED, not a descriptive string: AuditOutcome.resolve defaults anything it does not recognise
    // to ALLOWED, so an invented status records a refused send as a permitted one.
    expect(audited).toEqual([['ecommerce', 'email', 'real.customer@example.com', AuditOutcome.DENIED, { reason: 'non-production' }]]);
  });

  it('refuses when the tenant cannot be resolved — fail closed', async () => {
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('ghost');
    givenTenant(null);

    await expect(new TenantEnvironmentGate(db, audit).assert('network', 'https://example.com')).rejects.toBeInstanceOf(NonProductionRefusal);
  });

  it('still refuses when there is no audit sink', async () => {
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('sandbox');
    givenTenant({ id: 'sandbox', slug: 'sandbox', environment: TenantEnvironment.NON_PRODUCTION });

    await expect(new TenantEnvironmentGate(db).assert('scheduler', 'nightly-payouts')).rejects.toBeInstanceOf(NonProductionRefusal);
  });
});
