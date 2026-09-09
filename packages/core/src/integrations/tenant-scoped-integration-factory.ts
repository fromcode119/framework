import { SuppressedEmailDriver } from '@core/email/suppressed-email-driver';
import { IntegrationCoreRefreshService } from '@core/integrations/integration-core-refresh-service';
import { IntegrationTenantAccess } from '@core/integrations/integration-tenant-access';
import { IntegrationTenantResolver } from '@core/integrations/integration-tenant-resolver';
import { TenantScopedIntegration } from '@core/integrations/tenant-scoped-integration';
import type { IEmailDriver } from '@fromcode119/email';
import type { MediaManager } from '@fromcode119/media';
import type { CacheManager } from '@fromcode119/cache';
import type { QueueManager } from '@fromcode119/queue';

/**
 * Builds the four core integrations that every request touches, each one wrapped so it resolves to
 * the SITE making the request rather than to the platform.
 *
 * The comments on each method are the important part of this file: they record which method names
 * must stay synchronous and why. `TenantScopedIntegration` turns an unnamed method into a promise,
 * and `MediaManager.publicUrl` returns a string straight into rendered markup — a promise there
 * prints as "[object Promise]" in every image src on the page, with no error anywhere.
 *
 * Split out of `IntegrationManager` to bring it under the 300-line limit, along the seam between
 * BUILDING these instances and OWNING them. The manager still holds each result and the platform
 * fallbacks; this only assembles.
 */
export class TenantScopedIntegrationFactory {
  constructor(
    private readonly coreRefresh: IntegrationCoreRefreshService,
    private readonly tenantResolver: IntegrationTenantResolver,
  ) {}

  /**
   * Wrapped here rather than at `context.email`, so framework-internal senders (admin notifications,
   * auth mail) are covered too — everything that sends goes through this one driver. The tenant layer
   * sits INSIDE the suppression layer, so a bounced or unsubscribed address is refused whichever
   * site's mail server is about to be used.
   */
  email(platform: () => IEmailDriver, db: any): IEmailDriver { // eslint-disable-line @typescript-eslint/no-explicit-any
    return SuppressedEmailDriver.wrap(
      TenantScopedIntegration.wrap<IEmailDriver>(platform, (tenantId) => this.tenantResolver.emailFor(tenantId)),
      db,
    );
  }

  /**
   * `publicUrl` and `has` are SYNCHRONOUS and must stay that way — `publicUrl` returns a string into
   * rendered markup, and a promise there prints as "[object Promise]". They read the instance warmed
   * when the request was bound. `register` is deliberately NOT named: it configures the manager, and
   * configuration belongs to the platform.
   */
  storage(platform: () => MediaManager): MediaManager {
    return TenantScopedIntegration.wrap<MediaManager>(
      platform,
      (tenantId) => this.tenantResolver.instanceFor(tenantId, 'storage', () => this.coreRefresh.refreshStorage(true).then((r) => r.storage)),
      ['publicUrl', 'has'],
      () => IntegrationTenantAccess.forCurrentTenant<MediaManager>('storage'),
    );
  }

  /**
   * `applySettings` and `registerWorker` are synchronous AND boot-time: they run with no tenant bound,
   * so the synchronous path finds nothing warmed and correctly answers from the platform instance.
   * Naming them is what stops them being turned into promises.
   */
  queue(platform: () => QueueManager): QueueManager {
    return TenantScopedIntegration.wrap<QueueManager>(
      platform,
      (tenantId) => this.tenantResolver.instanceFor(tenantId, 'queue', () => this.coreRefresh.refreshQueue(true).then((r) => r.queue)),
      ['applySettings', 'registerWorker'],
      () => IntegrationTenantAccess.forCurrentTenant<QueueManager>('queue'),
    );
  }

  /**
   * Every CacheManager method is async, so no name needs the synchronous path. Sharing one cache
   * across sites is not merely untidy: a key one site writes is a key another site reads.
   */
  cache(platform: () => CacheManager): CacheManager {
    return TenantScopedIntegration.wrap<CacheManager>(
      platform,
      (tenantId) => this.tenantResolver.instanceFor(tenantId, 'cache', () => this.coreRefresh.refreshCache(true).then((r) => r.cache)),
    );
  }
}
