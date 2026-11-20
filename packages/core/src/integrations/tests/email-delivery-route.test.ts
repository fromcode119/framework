import { afterEach, describe, expect, it } from 'vitest';
import { IntegrationManager } from '@core/integrations/integration-manager';
import { RequestContextUtils } from '@core/context/request-context';
import { SettingChangeInvalidators } from '@core/settings/setting-change-invalidators';
import { SystemConstants } from '@core/constants/system.constants';
import { EmailDeliveryRoute } from '@core/integrations/enums/email-delivery-route.enum';

/**
 * The integrations page said "Mock Driver is in use — set in the server environment" for a site whose
 * every message was refused. `route` is what the page now states instead, and it must be the same
 * decision the site's mail driver takes.
 */
class RouteFixture {
  static async manager(fallback: boolean, platformResolved: unknown): Promise<IntegrationManager> {
    const db = {
      findOne: async (_table: string, where: { key?: string }) => (
        where?.key === SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK ? { value: String(fallback) } : null
      ),
    };
    const manager = new IntegrationManager(db as any, '/tmp', { info() {}, warn() {}, error() {}, debug() {} } as any);
    (manager as any).coreRefresh.refreshEmail = async () => ({ email: { platform: true }, resolved: platformResolved });
    await manager.refreshEmail();
    return manager;
  }

  static route(manager: IntegrationManager, source: string, tenantId: string | null = 'site-a'): Promise<string | null> {
    const read = () => (manager as any).configReader.describeRoute('email', source);
    return tenantId ? RequestContextUtils.storage.run({ tenantId } as any, read) : read();
  }
}

describe('where a site\'s email actually goes', () => {
  afterEach(() => SettingChangeInvalidators.reset());

  it('is its own provider when the site saved one', async () => {
    expect(await RouteFixture.route(await RouteFixture.manager(false, { providerKey: 'mock' }), 'stored')).toBe(String(EmailDeliveryRoute.OWN));
  });

  it('is nowhere with no provider of its own and the fallback off', async () => {
    expect(await RouteFixture.route(await RouteFixture.manager(false, { providerKey: 'smtp' }), 'env')).toBe(String(EmailDeliveryRoute.NONE));
  });

  it('is nowhere when the fallback is on but the platform only has the mock', async () => {
    expect(await RouteFixture.route(await RouteFixture.manager(true, { providerKey: 'mock' }), 'default')).toBe(String(EmailDeliveryRoute.PLATFORM_UNAVAILABLE));
  });

  it('is the platform server when the fallback is on and the platform has a real one', async () => {
    expect(await RouteFixture.route(await RouteFixture.manager(true, { providerKey: 'smtp' }), 'env')).toBe(String(EmailDeliveryRoute.PLATFORM));
  });

  it('adds nothing with no site bound: the platform\'s provider is where its mail goes', async () => {
    expect(await RouteFixture.route(await RouteFixture.manager(false, { providerKey: 'mock' }), 'env', null)).toBeNull();
  });
});
