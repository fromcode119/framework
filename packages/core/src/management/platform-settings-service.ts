import { Logger } from '@core/logging';

/**
 * Resolver for NON-secret, NON-bootstrap platform configuration that may live either
 * in an environment variable OR in the `_system_meta` settings store (editable from the
 * admin Settings page) — so operators can change it without a redeploy.
 *
 * Precedence is ALWAYS env-first: `env ?? setting ?? default`. A value set in the host
 * environment wins and locks the behaviour; the DB setting only applies when the env var
 * is unset. This keeps existing deployments (which set these as env vars) behaving
 * identically, and lets the setting take over only once the env var is removed.
 *
 * What this is NOT for:
 *  - Bootstrap/infra (DATABASE_URL, DB_DIALECT, REDIS_URL, PLUGINS_DIR) — needed before
 *    the DB/settings store exists.
 *  - Root secrets (JWT_SECRET, INTEGRATION_SECRET_KEY) — the settings store is encrypted
 *    BY these; they cannot live inside what they protect.
 *  - Security policy (ENFORCE_PLUGIN_INTEGRITY, ENFORCE_PLUGIN_SIGNATURES) — deliberately
 *    env-only so a compromised admin/DB cannot switch enforcement off.
 *
 * The `_system_meta` accessor is injected at boot (once the DB is available) via
 * {@link registerAccessor}; before that, only env + default are used.
 */
export class PlatformSettingsService {
  private static logger = new Logger({ namespace: 'platform-settings' });
  private static accessor: ((key: string) => Promise<string | null>) | null = null;

  /** Wire the `_system_meta` reader once the DB is up (called during server/plugin boot). */
  public static registerAccessor(accessor: (key: string) => Promise<string | null>): void {
    this.accessor = accessor;
  }

  /** Read a raw `_system_meta` value, or null if unavailable. Never throws. */
  public static async getSetting(key: string): Promise<string | null> {
    if (!this.accessor) return null;
    try {
      const value = await this.accessor(key);
      const trimmed = typeof value === 'string' ? value.trim() : '';
      return trimmed ? trimmed : null;
    } catch (err) {
      this.logger.warn(`Failed to read platform setting "${key}": ${err}`);
      return null;
    }
  }

  /**
   * Resolve a value as `setting ?? env ?? fallback` — the admin Settings value wins, the
   * env var is the fallback. This matches how the framework resolves URLs for CORS, so the
   * admin UI is authoritative and consistent. The env value is passed in by the caller (it
   * owns which env var maps to which key) so this stays free of `process.env` coupling and
   * is trivially testable.
   */
  public static async resolve(envValue: string | undefined, settingKey: string, fallback = ''): Promise<string> {
    const setting = await this.getSetting(settingKey);
    if (setting) return setting;
    const env = typeof envValue === 'string' ? envValue.trim() : '';
    if (env) return env;
    return fallback;
  }

  /**
   * A stored boolean, defaulting to FALSE when nothing has been saved.
   *
   * Deliberately not `resolve()`: that one is env-first for values an operator sets per deployment,
   * and this is a choice made in the admin. An unset setting is not "unknown", it is "no" — which is
   * what makes a default-closed switch safe to read before anyone has ever opened the screen.
   */
  public static async readFlag(settingKey: string): Promise<boolean> {
    const value = (await this.getSetting(settingKey)) ?? '';
    return value === 'true' || value === '1' || value === 'on' || value === 'yes';
  }

  /**
   * Canonical `_system_meta` keys for platform settings. These match the keys written by
   * the admin General Settings page, so a value saved there is read back here.
   */
  public static readonly KEY = {
    MARKETPLACE_URL: 'marketplace_url',
    /** `owner/repo` the framework checks for its own releases when no marketplace is configured. */
    FRAMEWORK_REPOSITORY: 'framework_repository',
    /**
     * Where Sources writes what it builds.
     *
     * Deliberately an operator setting rather than a derived path: build output must never land in
     * `process.cwd()` — in the api container that is `/app`, which the app user cannot write, and
     * `/app/plugins` and `/app/themes` are the LIVE mounted repositories, so writing there would
     * overwrite the very sources being packaged. Blank uses `<project root>/data/sources`.
     */
    SOURCES_WORKSPACE_ROOT: 'sources_workspace_root',
    /**
     * Whether search engines may index the ADMIN.
     *
     * Off unless an operator turns it on. The admin is an operations console: its login page names
     * the platform and the customer, its URL structure describes the installation, and none of that
     * is content anyone searched for. Nothing was stopping a crawler before this — no robots.txt, no
     * `X-Robots-Tag`, no meta — so it was indexable by omission rather than by decision.
     *
     * A setting rather than a hardcoded refusal, because an installation that deliberately serves a
     * public surface from the admin host must be able to say so.
     */
    ADMIN_SEARCH_INDEXING: 'admin_search_indexing',
  } as const;
}
