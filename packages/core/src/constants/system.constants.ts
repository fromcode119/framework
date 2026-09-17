import { AppPathConstants } from '@core/constants/app-path.constants';
import { RouteConstants } from '@core/constants/route.constants';
import { SystemMetaKeys } from '@core/constants/system-meta-keys.constants';
import { SystemTables } from '@core/constants/system-tables.constants';
import { SystemApiPaths } from '@core/constants/system-api-paths.constants';

/**
 * System-reserved database tables.
 * Plugins should use these names instead of hardcoded strings.
 */
export class SystemConstants {
  private static readonly ROUTE_SEGMENTS = RouteConstants.SEGMENTS;

  /** Every physical table the framework owns — see {@link SystemTables}. */
  static readonly TABLE = SystemTables.ALL;

  /**
   * Well-known keys in the system meta table.
   */
  /**
   * The storefront's default for `META_KEY.SSR_GENERATION_CAP` when the operator has not set one.
   * Mirrored by the Infrastructure page's placeholder — one number, stated in one place.
   */
  static readonly SSR_GENERATION_CAP_DEFAULT = 4;

  /**
   * Plugin isolation (T5): the platform defaults the Infrastructure page shows as placeholders. An
   * isolated plugin runs in its own process with this heap ceiling and this per-invocation deadline.
   */
  static readonly PLUGIN_ISOLATION_MEMORY_MB_DEFAULT = 256;
  static readonly PLUGIN_ISOLATION_TIMEOUT_MS_DEFAULT = 30_000;

  /**
   * Theme render hosts (T5b): each resident server-render world is its own process with this heap
   * ceiling and this per-render deadline. Placeholders on the Infrastructure page mirror these.
   */
  static readonly SSR_RENDER_MEMORY_MB_DEFAULT = 512;

  /**
   * Background-job defaults. A job that throws used to be gone: nothing set `attempts`, so BullMQ's
   * default of one applied, nobody was told, and completed jobs stayed in Redis for ever.
   */
  static readonly QUEUE_JOB_ATTEMPTS_DEFAULT = 3;
  /** First retry delay; BullMQ doubles it per attempt under an exponential backoff. */
  static readonly QUEUE_JOB_BACKOFF_MS_DEFAULT = 5_000;
  /** How many finished jobs to keep for inspection before Redis starts discarding the oldest. */
  static readonly QUEUE_KEEP_COMPLETED_DEFAULT = 100;
  /** Failures are kept longer than successes: they are the ones somebody needs to read. */
  static readonly QUEUE_KEEP_FAILED_DEFAULT = 500;
  static readonly QUEUE_CONCURRENCY_DEFAULT = 1;
  static readonly SSR_RENDER_TIMEOUT_MS_DEFAULT = 10_000;

  /**
   * OS identities (T5c). The app processes give up root for RUN_AS_USER the moment they start; each
   * isolated plugin runs as PLUGIN_UID_BASE plus the number the registry assigned it (kept in
   * `_system_plugins.isolation_uid`, so a plugin keeps its files across restarts); every theme render
   * host runs as THEME_UID. None of these need a passwd entry — the kernel only needs the number.
   * RUNTIME_DIR holds the per-guest socket directories the privileged spawner creates.
   */
  static readonly PROCESS_ISOLATION = {
    RUN_AS_USER: 'node',
    PLUGIN_UID_BASE: 20000,
    THEME_UID: 21000,
    RUNTIME_DIR: '/run/fromcode',
  } as const;

  /** Well-known keys in the system meta table — see {@link SystemMetaKeys}. */
  static readonly META_KEY = SystemMetaKeys.ALL;

  /** Every API path the framework serves — see {@link SystemApiPaths}. */
  static readonly API_PATH = SystemApiPaths.ALL;

  /**
   * Paths the admin and frontend apps serve for the api to call directly, server to server.
   *
   * Not part of `API_PATH`: these live on the Next apps themselves, not behind the api's versioned
   * prefix, and they authenticate with {@link InternalServiceAuth}'s shared secret rather than a
   * session. Declared here so the caller and the two receivers cannot drift.
   */
  static readonly INTERNAL_APP_PATH = {
    /** Exits the app so its supervisor restarts it. */
    RESTART: '/internal/restart',
    /** What the frontend can see of the theme/plugin server bundles it renders from. Read-only. */
    SSR_STATUS: '/internal/ssr-status',
  } as const;

  /**
   * Frontend app routes (non-API page paths).
   */
  static readonly APP_PATH = {
  AUTH: AppPathConstants.AUTH,
  ADMIN: AppPathConstants.ADMIN
  } as const;

  /**
   * Storage / upload infrastructure configuration keys.
   */
  /**
   * On-disk layout INSIDE a theme package. The `ui` directory is also the `ui` segment of the served
   * route (`API_PATH.THEMES.UI`), which is why a served asset path maps onto disk one-for-one — see
   * `MediaPathUtils.resolveSafeThemeAssetDiskPath`. It was written out as a bare `'ui'` in four places.
   */
  static readonly THEME_DIR = {
    UI: 'ui',
  } as const;

  /** Where tenant archives (exports, pre-delete safety copies) live under the backups root. */
  static readonly BACKUPS = {
    TENANTS_SUBDIR: 'tenants',
  };

  static readonly STORAGE = {
  UPLOAD_DIR_ENV: 'STORAGE_UPLOAD_DIR',
  PUBLIC_URL_ENV: 'STORAGE_PUBLIC_URL',
  DEFAULT_UPLOADS_SUBDIR: 'public/uploads',
  /** Per-tenant file subdirectory under the uploads root. Single-tenant installs never use it. */
  TENANTS_SUBDIR: 'tenants',
  DEFAULT_PUBLIC_URL: '/uploads',
  /**
   * Where PRIVATE files live. The default deliberately sits OUTSIDE `public/`: the uploads dir is
   * handed to `express.static` twice, and those mounts are registered before cookies, CSRF, auth and
   * the rate limiter — so anything reachable from them is anonymous and unthrottled by construction.
   * A private file under that tree would be public no matter what guards its route carries.
   */
  PRIVATE_DIR_ENV: 'STORAGE_PRIVATE_DIR',
  DEFAULT_PRIVATE_SUBDIR: 'storage/private'
  } as const;

  /**
   * The shortest audit-retention window the platform will accept, in days.
   *
   * Six months, because `packages/ai/src/extension.ts` declares `_system_audit_logs` the EU AI Act
   * Art. 12 record-keeping store and Art. 19/26 expect those records to survive six months. This is
   * enforced as a REFUSAL with a stated reason, never a silent clamp: an operator who asks for 30
   * days is told why they cannot have it, rather than being given 180 and left believing they got
   * 30. Keeping forever (an empty value) is always allowed — the floor is a minimum, not a schedule.
   */
  static readonly AUDIT_RETENTION_MIN_DAYS = 180;

  /**
   * Route prefix strings used for internal permission checks.
   */
  static readonly PUBLIC_ROUTE_PREFIXES = {
  PLUGIN_ASSETS: `${SystemConstants.ROUTE_SEGMENTS.PLUGINS}/`,
  THEME_ASSETS: `${SystemConstants.ROUTE_SEGMENTS.THEMES}/`
  } as const;

}
