import { describe, expect, it, vi } from 'vitest';
import { WebhookService } from '@core/webhook/webhook-service';
import { HookManager } from '@core/hooks/hook-manager';
import { HookEventUtils } from '@core/hook-events';
import { WebhooksCollection } from '@core/collections/webhooks';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * `webhooks` is tenant-scoped, and the service held ONE list for the process, refreshed under whichever
 * site's request crossed the TTL. For the next thirty seconds every other site's events were matched
 * against that site's endpoints and delivered to them.
 */
class WebhookFixture {
  /** What each site's connection would return — row-level security, simulated. */
  static rows: Record<string, Array<Record<string, unknown>>> = {};
  static reads = 0;

  static async service(): Promise<{ service: WebhookService; hooks: HookManager; delivered: string[] }> {
    const db = {
      find: async () => { WebhookFixture.reads += 1; return WebhookFixture.rows[String(RequestContextUtils.getTenantId() ?? '')] ?? []; },
      update: async () => null,
      insert: async () => null,
    };
    const hooks = new HookManager();
    const service = new WebhookService(db, hooks);
    await service.initialize();
    const delivered: string[] = [];
    (service as any).executeWebhook = async (webhook: { url: string }) => { delivered.push(webhook.url); };
    return { service, hooks, delivered };
  }

  static asSite<T>(tenantId: string, run: () => Promise<T>): Promise<T> {
    return RequestContextUtils.storage.run({ tenantId } as any, run);
  }
}

describe('WebhookService per site', () => {
  it('delivers a site\'s event only to that site\'s webhooks, even inside the TTL', async () => {
    WebhookFixture.rows = {
      'site-a': [{ id: 1, url: 'https://a.example/hook', events: ['*'] }],
      'site-b': [{ id: 2, url: 'https://b.example/hook', events: ['*'] }],
    };
    const { service, delivered } = await WebhookFixture.service();

    await WebhookFixture.asSite('site-a', () => service.processEvent('order.created', {}));
    await WebhookFixture.asSite('site-b', () => service.processEvent('order.created', {}));

    expect(delivered).toEqual(['https://a.example/hook', 'https://b.example/hook']);
  });

  it('a webhook saved by a site applies to its next event, not after the TTL', async () => {
    WebhookFixture.rows = { 'site-a': [] };
    const { service, hooks, delivered } = await WebhookFixture.service();
    await WebhookFixture.asSite('site-a', () => service.processEvent('order.created', {}));
    expect(delivered).toEqual([]);

    WebhookFixture.rows = { 'site-a': [{ id: 1, url: 'https://a.example/hook', events: ['order.*'] }] };
    await WebhookFixture.asSite('site-a', async () => { await hooks.emit(HookEventUtils.afterSave(WebhooksCollection.slug), { id: 1 }); });
    await WebhookFixture.asSite('site-a', () => service.processEvent('order.created', {}));

    expect(delivered).toEqual(['https://a.example/hook']);
  });

  it('reads a site\'s list once per TTL', async () => {
    WebhookFixture.rows = { 'site-a': [] };
    WebhookFixture.reads = 0;
    const { service } = await WebhookFixture.service();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    await WebhookFixture.asSite('site-a', () => service.processEvent('x', {}));
    await WebhookFixture.asSite('site-a', () => service.processEvent('y', {}));

    expect(WebhookFixture.reads).toBe(1);
    vi.restoreAllMocks();
  });
});
