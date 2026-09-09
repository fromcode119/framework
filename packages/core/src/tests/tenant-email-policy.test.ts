import { describe, expect, it } from 'vitest';
import { TenantEmailPolicy } from '@core/integrations/tenant-email-policy';
import { UnconfiguredTenantEmailDriver } from '@core/integrations/unconfigured-tenant-email-driver';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * A site with no mail configuration used to inherit the PLATFORM's SMTP silently: the send succeeded,
 * so nothing reported a problem, while the customer's mail left on the platform's server under the
 * platform's SPF and DKIM. Borrowing another party's mail server is a decision, and a decision has to be
 * recorded somewhere an operator can see.
 */
describe('TenantEmailPolicy', () => {
  const dbReturning = (value: unknown) => ({ findOne: async () => (value === undefined ? null : { value }) });

  it('refuses the platform sender when the site has said nothing', async () => {
    expect(await TenantEmailPolicy.permitsPlatformSender(dbReturning(undefined))).toBe(false);
  });

  it('permits it only on an explicit true', async () => {
    for (const yes of [true, 'true', '1']) {
      expect(await TenantEmailPolicy.permitsPlatformSender(dbReturning(yes)), `${String(yes)} should permit`).toBe(true);
    }
    for (const no of [false, 'false', '0', '', 'maybe']) {
      expect(await TenantEmailPolicy.permitsPlatformSender(dbReturning(no)), `${String(no)} should refuse`).toBe(false);
    }
  });

  it('refuses when the read itself fails — a broken query is not consent', async () => {
    const db = { findOne: async () => { throw new Error('connection reset'); } };
    expect(await TenantEmailPolicy.permitsPlatformSender(db)).toBe(false);
  });

  it('reads the tenant-scoped key, so the connection decides whose answer comes back', async () => {
    let asked: unknown;
    const db = { findOne: async (_table: string, where: unknown) => { asked = where; return null; } };
    await TenantEmailPolicy.permitsPlatformSender(db);
    expect(asked).toEqual({ key: SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK });
  });
});

describe('UnconfiguredTenantEmailDriver', () => {
  it('throws rather than appearing to send, and says how to fix it', async () => {
    const driver = new UnconfiguredTenantEmailDriver('acme');
    await expect(driver.send({ to: 'a@b.test', subject: 's', html: 'h' } as never)).rejects.toThrow(/acme/);
    await expect(driver.send({ to: 'a@b.test', subject: 's', html: 'h' } as never))
      .rejects.toThrow(new RegExp(SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK));
  });
});
