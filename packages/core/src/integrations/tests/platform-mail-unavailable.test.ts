import { afterEach, describe, expect, it } from 'vitest';
import { IntegrationManager } from '@core/integrations/integration-manager';
import { RequestContextUtils } from '@core/context/request-context';
import { SettingChangeInvalidators } from '@core/settings/setting-change-invalidators';
import { SystemConstants } from '@core/constants/system.constants';
import { PlatformMailUnavailableEmailDriver } from '@core/integrations/platform-mail-unavailable-email-driver';

/**
 * A site allowed the platform's mail server was handed the platform's `mock` driver when the platform
 * had no SMTP of its own: every send reported delivered and was dropped (production, 2026-09-26).
 */
class MockPlatformFixture {
  static manager(resolved: unknown): IntegrationManager {
    const db = {
      findOne: async (_table: string, where: { key?: string }) => (
        where?.key === SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK ? { value: 'true' } : null
      ),
    };
    const manager = new IntegrationManager(db as any, '/tmp', { info() {}, warn() {}, error() {}, debug() {} } as any);
    (manager as any).coreRefresh.refreshEmail = async () => ({ email: { platform: true }, resolved });
    return manager;
  }

  static async driverFor(manager: IntegrationManager, tenantId: string): Promise<any> {
    const wrapped = await RequestContextUtils.storage.run({ tenantId } as any, () => (manager as any).tenantResolver.emailFor(tenantId));
    return (wrapped as any).inner;
  }
}

describe('the platform sender when the platform only has the mock', () => {
  afterEach(() => SettingChangeInvalidators.reset());

  it('refuses instead of handing the site the mock', async () => {
    const driver = await MockPlatformFixture.driverFor(MockPlatformFixture.manager({ source: 'env', providerKey: 'mock' }), 'site-a');
    expect(driver).toBeInstanceOf(PlatformMailUnavailableEmailDriver);
    await expect(driver.send({ to: 'x@example.com', subject: 's', text: 't' })).rejects.toThrow(/mock driver/);
  });

  it('refuses when the platform email integration failed and fell back to the mock (resolved = null)', async () => {
    const driver = await MockPlatformFixture.driverFor(MockPlatformFixture.manager(null), 'site-a');
    expect(driver).toBeInstanceOf(PlatformMailUnavailableEmailDriver);
  });

  it('still hands over a real platform provider', async () => {
    const driver = await MockPlatformFixture.driverFor(MockPlatformFixture.manager({ source: 'env', providerKey: 'smtp' }), 'site-a');
    expect(driver).toEqual({ platform: true });
  });
});

describe('PlatformMailUnavailableEmailDriver.isMock', () => {
  it('is the mock only when nothing resolved or every provider is mock', () => {
    expect(PlatformMailUnavailableEmailDriver.isMock(null)).toBe(true);
    expect(PlatformMailUnavailableEmailDriver.isMock({ providerKey: 'mock' })).toBe(true);
    expect(PlatformMailUnavailableEmailDriver.isMock([{ providerKey: 'mock' }, { providerKey: 'mock' }])).toBe(true);
    expect(PlatformMailUnavailableEmailDriver.isMock([{ providerKey: 'mock' }, { providerKey: 'smtp' }])).toBe(false);
    expect(PlatformMailUnavailableEmailDriver.isMock({ providerKey: 'smtp' })).toBe(false);
    expect(PlatformMailUnavailableEmailDriver.isMock({ source: 'default' })).toBe(false);
  });
});
