import { Logger } from '@core/logging';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Which catalogue THIS SITE browses.
 *
 * ONE key — `marketplace_url` — for the platform and for every site, because the settings store is
 * already partitioned by site and does not need a second name to express "mine".
 *
 * `_system_meta` is keyed `(key, tenant_id)` with NULLS NOT DISTINCT, so a site's own row sits
 * alongside the platform's under the same key rather than colliding with it. Its row-level policy then
 * does both halves of the job:
 *
 *   READ  — a tenant sees its own rows, and additionally the platform's `tenant_id IS NULL` row for an
 *           allowlist of keys that `marketplace_url` is already on. So a site that has chosen nothing
 *           INHERITS the operator's catalogue through the same key, with no fallback logic to write.
 *   WRITE — `WITH CHECK` allows a tenant to write only `tenant_id = itself`; writing the platform's
 *           NULL row needs `app.platform_admin`. A site therefore cannot overwrite the operator's
 *           value even by accident.
 *
 * All this resolver adds is PRECEDENCE, which is the one thing the policy cannot express: when both
 * rows are visible the site's own is the answer. `findOne` would have returned whichever the planner
 * happened to hand back first.
 *
 * There was briefly a second key for the site's value. It was never necessary — this is what the
 * schema was already built to do — and no deployment ever stored one.
 */
export class SiteMarketplaceUrl {
  private static readonly logger = new Logger({ namespace: 'site-marketplace' });
  private static accessor: ((key: string) => Promise<Array<{ tenantId: string | null; value: string }>>) | null = null;

  /**
   * Wire the `_system_meta` reader once the DB is up.
   *
   * It returns ROWS, not a value: the precedence below needs to know which site each row belongs to,
   * and that is invisible once a single value has been picked.
   */
  static registerAccessor(
    accessor: (key: string) => Promise<Array<{ tenantId: string | null; value: string }>>,
  ): void {
    SiteMarketplaceUrl.accessor = accessor;
  }

  /** Forgets nothing of its own — kept so tests can unwire the accessor between cases. */
  static reset(): void {
    SiteMarketplaceUrl.accessor = null;
  }

  /**
   * The catalogue URL in force for the current request's site.
   *
   * The site's own row wins; the platform's is what every site that has chosen nothing gets. `envValue`
   * is last and only when the store holds nothing at all — it is how a deployment configured this
   * before the setting existed. The caller passes it, exactly as `PlatformSettingsService.resolve`
   * requires, so this stays free of `process.env` coupling and is testable without it.
   */
  static async current(envValue?: string): Promise<string> {
    const rows = await SiteMarketplaceUrl.rows();
    const scope = SiteMarketplaceUrl.currentScopeKey();

    const own = scope ? rows.find((row) => String(row.tenantId ?? '') === scope)?.value ?? '' : '';
    if (own) return own;

    const platform = rows.find((row) => row.tenantId === null)?.value ?? '';
    if (platform) return platform;

    return String(envValue ?? '').trim();
  }

  /**
   * The cache key for the resolved client: the site whose catalogue this is, or `''` for the
   * platform's.
   *
   * Exposed because the caller caching a built client MUST key it by this and not by nothing. One
   * client held for the life of the process would serve the first site's catalogue to every site
   * after it.
   */
  static currentScopeKey(): string {
    return String(RequestContextUtils.getTenantId() ?? '').trim();
  }

  /**
   * A FAILED READ IS NOT A CHOICE. If the rows cannot be read this answers with none rather than
   * pretending the store was empty in a way that looks like a deliberate "off": the caller then falls
   * through to the environment, which is the last thing an operator explicitly set.
   */
  private static async rows(): Promise<Array<{ tenantId: string | null; value: string }>> {
    if (!SiteMarketplaceUrl.accessor) return [];
    try {
      return (await SiteMarketplaceUrl.accessor(SystemConstants.META_KEY.MARKETPLACE_URL)) ?? [];
    } catch (error: unknown) {
      SiteMarketplaceUrl.logger.warn(
        `Could not read "${SystemConstants.META_KEY.MARKETPLACE_URL}". `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
