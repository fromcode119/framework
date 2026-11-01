import { afterEach, describe, expect, it } from 'vitest';
import { IntegrationManager } from '@core/integrations/integration-manager';
import { RequestContextUtils } from '@core/context/request-context';
import { SettingChangeInvalidators } from '@core/settings/setting-change-invalidators';
import { SystemConstants } from '@core/constants/system.constants';
import { UnconfiguredTenantEmailDriver } from '@core/integrations/unconfigured-tenant-email-driver';
import { PlatformMailUnavailableEmailDriver } from '@core/integrations/platform-mail-unavailable-email-driver';

/**
 * "Send through the platform's mail server" is decided when a site's mail driver is resolved, and the
 * driver is cached for the life of the process. Saving the setting wrote the row and changed nothing:
 * a site that had just been allowed the platform's server went on refusing every send until the api
 * restarted, and one whose permission was withdrawn went on sending through it.
 */
class FallbackFixture {
  /** The site's stored answer for `email_platform_fallback`. */
  static allowed = false;

  static async manager(): Promise<IntegrationManager> {
    const db = {
      findOne: async (_table: string, where: { key?: string }) => (
        where?.key === SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK ? { value: String(FallbackFixture.allowed) } : null
      ),
    };
    const manager = new IntegrationManager(db as any, '/tmp', { info() {}, warn() {}, error() {}, debug() {} } as any);
    // As on a real tenant connection: the platform's rows are invisible from a site, so a site with no
    // mail of its own resolves to the MOCK, while the platform itself resolves its stored SMTP.
    (manager as any).coreRefresh.refreshEmail = async () => (
      RequestContextUtils.getTenantId()
        ? { email: { mock: true }, resolved: { providerKey: 'mock', source: 'default' } }
        : { email: { platform: true }, resolved: { providerKey: 'smtp', source: 'stored' } }
    );
    await manager.refreshEmail();
    return manager;
  }

  /** The driver the site would send with, unwrapped from the non-production gate. */
  static async driverFor(manager: IntegrationManager, tenantId: string): Promise<unknown> {
    const wrapped = await RequestContextUtils.storage.run({ tenantId } as any, () => (manager as any).tenantResolver.emailFor(tenantId));
    return (wrapped as any).inner;
  }
}

describe('email_platform_fallback takes effect on save', () => {
  afterEach(() => {
    FallbackFixture.allowed = false;
    SettingChangeInvalidators.reset();
  });

  it('a site allowed the platform sender gets it on its next send, not after a restart', async () => {
    const manager = await FallbackFixture.manager();
    expect(await FallbackFixture.driverFor(manager, 'site-a')).toBeInstanceOf(UnconfiguredTenantEmailDriver);

    FallbackFixture.allowed = true;
    SettingChangeInvalidators.dispatch([{ key: SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK, tenantId: 'site-a' }]);

    expect(await FallbackFixture.driverFor(manager, 'site-a')).toEqual({ platform: true });
  });

  it('withdrawing the permission stops the platform sender at once', async () => {
    FallbackFixture.allowed = true;
    const manager = await FallbackFixture.manager();
    expect(await FallbackFixture.driverFor(manager, 'site-a')).toEqual({ platform: true });

    FallbackFixture.allowed = false;
    SettingChangeInvalidators.dispatch([{ key: SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK, tenantId: 'site-a' }]);

    expect(await FallbackFixture.driverFor(manager, 'site-a')).toBeInstanceOf(UnconfiguredTenantEmailDriver);
  });

  it('one site\'s save leaves another site\'s driver alone', async () => {
    const manager = await FallbackFixture.manager();
    const instances: Map<string, unknown> = (manager as any).instances;
    await FallbackFixture.driverFor(manager, 'site-a');
    await FallbackFixture.driverFor(manager, 'site-b');

    SettingChangeInvalidators.dispatch([{ key: SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK, tenantId: 'site-a' }]);

    expect(instances.has('site-a::email')).toBe(false);
    expect(instances.has('site-b::email')).toBe(true);
  });
});

describe('a site sending through the platform', () => {
  afterEach(() => {
    FallbackFixture.allowed = false;
    SettingChangeInvalidators.reset();
  });

  it('gets the platform\'s real server even though its own connection cannot see it', async () => {
    FallbackFixture.allowed = true;
    const manager = await FallbackFixture.manager();
    expect(await FallbackFixture.driverFor(manager, 'site-a')).toEqual({ platform: true });
  });

  it('is refused when the platform itself has only the mock', async () => {
    FallbackFixture.allowed = true;
    const manager = await FallbackFixture.manager();
    (manager as any).coreRefresh.refreshEmail = async () => ({ email: { mock: true }, resolved: { providerKey: 'mock', source: 'default' } });
    await manager.refreshEmail();
    expect(await FallbackFixture.driverFor(manager, 'site-a')).toBeInstanceOf(PlatformMailUnavailableEmailDriver);
  });

  it('a site saving its own mail never replaces the platform\'s', async () => {
    const manager = await FallbackFixture.manager();
    await RequestContextUtils.storage.run({ tenantId: 'site-a' } as any, () => (manager as any).refreshType('email'));
    expect((manager as any).platformEmail).toEqual({ platform: true });
  });
});
