import { describe, expect, it } from 'vitest';
import { TenantScopedIntegration } from '@core/integrations/tenant-scoped-integration';
import { RequestContextUtils } from '@core/context/request-context';

class SenderFixture {
  readonly sent: string[] = [];
  constructor(readonly name: string) {}
  async send(subject: string): Promise<string> {
    this.sent.push(subject);
    return this.name;
  }
}

describe('TenantScopedIntegration', () => {
  it("uses the current site's own instance, not the one resolved at boot", async () => {
    const platform = new SenderFixture('platform');
    const shop = new SenderFixture('shop');
    const wrapped = TenantScopedIntegration.wrap<SenderFixture>(() => platform, async () => shop);

    const result = await RequestContextUtils.storage.run({ tenantId: 'vselenskiportal' } as any, () =>
      wrapped.send('Order received'));

    expect(result).toBe('shop');
    expect(shop.sent).toEqual(['Order received']);
    expect(platform.sent).toEqual([]);
  });

  it('falls back to the platform instance when no site is in scope', async () => {
    const platform = new SenderFixture('platform');
    const wrapped = TenantScopedIntegration.wrap<SenderFixture>(() => platform, async () => {
      throw new Error('should not resolve');
    });

    await expect(wrapped.send('Boot notice')).resolves.toBe('platform');
    expect(platform.sent).toEqual(['Boot notice']);
  });

  it('reads data properties straight from the platform instance', () => {
    const platform = new SenderFixture('platform');
    const wrapped = TenantScopedIntegration.wrap<SenderFixture>(() => platform, async () => platform);
    expect(wrapped.name).toBe('platform');
  });
});
