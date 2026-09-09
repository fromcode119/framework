import { Logger } from '@core/logging';
import { SettingSource } from '@core/settings/enums/setting-source.enum';
import { SystemConstants } from '@core/constants/system.constants';
import { IntegrationCoreRefreshService } from '@core/integrations/integration-core-refresh-service';
import { TenantEmailPolicy } from '@core/integrations/tenant-email-policy';
import { UnconfiguredTenantEmailDriver } from '@core/integrations/unconfigured-tenant-email-driver';
import type { IEmailDriver } from '@fromcode119/email';

/**
 * Resolving ONE site's copy of a core integration, and remembering it.
 *
 * Every read here runs on the request's own tenant-bound connection, so `IntegrationCoreRefreshService`
 * sees that site's stored configuration and nobody else's. There is no tenant id passed down into the
 * query and therefore no way to read across — the isolation is the connection's, not a filter's, which
 * is why a bug here cannot quietly widen into a cross-site leak.
 *
 * Split out of `IntegrationManager` to bring it under the 300-line limit. The seam is real rather than
 * arbitrary: the manager owns the PLATFORM instances and the wrapping, this owns per-site resolution
 * and the cache those wrappers call into.
 */
export class IntegrationTenantResolver {
  /**
   * The manager's OWN instance map, shared rather than duplicated.
   *
   * Keys are `<tenantId>::<type>` on both sides, and the manager's generic `get()` path reads and
   * writes the same entries these methods do. Two maps would mean a site's storage could be dropped
   * from one and survive in the other, which is the kind of half-invalidation that shows up as one
   * request in fifty using stale configuration.
   */
  constructor(
    private readonly db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    private readonly coreRefresh: IntegrationCoreRefreshService,
    private readonly logger: Logger,
    private readonly instances: Map<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {}

  /**
   * One tenant's instance of a core type, resolved once and kept beside its other integrations.
   */
  async instanceFor<T>(tenantId: string, type: string, resolve: () => Promise<T>): Promise<T> {
    const key = `${tenantId}::${type}`;
    const cached = this.instances.get(key);
    if (cached) return cached as T;
    const instance = await resolve();
    this.instances.set(key, instance);
    return instance;
  }

  /**
   * That tenant's own email driver, resolved on first send and kept beside its other integrations.
   *
   * `source` is the load-bearing part. STORED means this site configured its own mail. Anything else
   * means resolution fell through to the platform's environment or to `mock`, and the site would have
   * been sending on the platform's server — or reporting delivery while dropping the message — with
   * nothing saying so. That now needs the site's explicit consent, and without it the send fails.
   */
  async emailFor(tenantId: string): Promise<IEmailDriver> {
    const key = `${tenantId}::email`;
    const cached = this.instances.get(key) as IEmailDriver | undefined;
    if (cached) return cached;
    const { email, resolved } = await this.coreRefresh.refreshEmail(true);
    // Compared by VALUE, not identity: `Enum` has no `equals`, and `toString()` returns the value, so
    // this holds whether `source` is the enum member the resolver sets or a string it survived as.
    const driver = String(resolved?.source) === String(SettingSource.STORED)
      ? email
      : await this.platformSenderOrRefusal(tenantId, email);
    this.instances.set(key, driver);
    return driver;
  }

  /**
   * Resolves ONE type for ONE site, for `IntegrationTenantAccess.warm` — the call the request binder
   * makes, inside that site's connection scope, before any plugin code runs.
   *
   * Returning `undefined` for an unknown type is deliberate: only these four are warmed eagerly, and
   * anything else is resolved on demand through the manager's generic `get()`.
   */
  async warmOne(tenantId: string, type: string): Promise<unknown> {
    if (type === 'email') return this.emailFor(tenantId);
    if (type === 'storage') return this.instanceFor(tenantId, 'storage', () => this.coreRefresh.refreshStorage(true).then((r) => r.storage));
    if (type === 'cache') return this.instanceFor(tenantId, 'cache', () => this.coreRefresh.refreshCache(true).then((r) => r.cache));
    if (type === 'queue') return this.instanceFor(tenantId, 'queue', () => this.coreRefresh.refreshQueue(true).then((r) => r.queue));
    return undefined;
  }

  /** The platform's own driver when this site has opted in, and a driver that refuses when it has not. */
  private async platformSenderOrRefusal(tenantId: string, platformDriver: IEmailDriver): Promise<IEmailDriver> {
    if (await TenantEmailPolicy.permitsPlatformSender(this.db)) {
      this.logger.warn(
        `Site "${tenantId}" has no mail configuration of its own and is sending through the PLATFORM's `
        + 'mail server, under the platform\'s SPF, DKIM and sending reputation. It opted into this with '
        + `"${SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK}".`,
      );
      return platformDriver;
    }
    return new UnconfiguredTenantEmailDriver(tenantId);
  }
}
