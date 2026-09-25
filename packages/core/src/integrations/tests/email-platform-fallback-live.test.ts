import { afterEach, describe, expect, it } from 'vitest';
import { IntegrationManager } from '@core/integrations/integration-manager';
import { RequestContextUtils } from '@core/context/request-context';
import { SettingChangeInvalidators } from '@core/settings/setting-change-invalidators';
import { SystemConstants } from '@core/constants/system.constants';
import { UnconfiguredTenantEmailDriver } from '@core/integrations/unconfigured-tenant-email-driver';

/**
 * "Send through the platform's mail server" is decided when a site's mail driver is resolved, and the
 * driver is cached for the life of the process. Saving the setting wrote the row and changed nothing:
 * a site that had just been allowed the platform's server went on refusing every send until the api
 * restarted, and one whose permission was withdrawn went on sending through it.
 */
class FallbackFixture {
  /** The site's stored answer for `email_platform_fallback`. */
  static allowed = false;

  static manager(): IntegrationManager {
    const db = {
      findOne: async (_table: string, where: { key?: string }) => (
        where?.key === SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK ? { value: String(FallbackFixture.allowed) } : null
      ),
    };
    const manager = new IntegrationManager(db as any, '/tmp', { info() {}, warn() {}, error() {}, debug() {} } as any);
    // The site stored no mail of its own: the resolver hands back the platform's driver as a DEFAULT.
    (manager as any).coreRefresh.refreshEmail = async () => ({ email: { platform: true }, resolved: { source: 'default' } });
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
    const manager = FallbackFixture.manager();
    expect(await FallbackFixture.driverFor(manager, 'site-a')).toBeInstanceOf(UnconfiguredTenantEmailDriver);

    FallbackFixture.allowed = true;
    SettingChangeInvalidators.dispatch([{ key: SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK, tenantId: 'site-a' }]);

    expect(await FallbackFixture.driverFor(manager, 'site-a')).toEqual({ platform: true });
  });

  it('withdrawing the permission stops the platform sender at once', async () => {
    FallbackFixture.allowed = true;
    const manager = FallbackFixture.manager();
    expect(await FallbackFixture.driverFor(manager, 'site-a')).toEqual({ platform: true });

    FallbackFixture.allowed = false;
    SettingChangeInvalidators.dispatch([{ key: SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK, tenantId: 'site-a' }]);

    expect(await FallbackFixture.driverFor(manager, 'site-a')).toBeInstanceOf(UnconfiguredTenantEmailDriver);
  });

  it('one site\'s save leaves another site\'s driver alone', async () => {
    const manager = FallbackFixture.manager();
    const instances: Map<string, unknown> = (manager as any).instances;
    await FallbackFixture.driverFor(manager, 'site-a');
    await FallbackFixture.driverFor(manager, 'site-b');

    SettingChangeInvalidators.dispatch([{ key: SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK, tenantId: 'site-a' }]);

    expect(instances.has('site-a::email')).toBe(false);
    expect(instances.has('site-b::email')).toBe(true);
  });
});
