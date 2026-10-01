import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The database pool row of {@link SystemSettingDescriptors} — Settings → Infrastructure. PLATFORM
 * scoped: the api reads it from its settings cache each time its pool decides whether it may open
 * another connection (DatabasePoolRegistry), so a save applies without a restart.
 */
export class DatabasePoolSettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.DATABASE_POOL_MAX]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true, range: { min: 5, max: 80 },
      seed: { value: '20', description: "Most database connections the api holds at once for the requests it serves. Every site shares them; when all are in use, a request waits for one to come back. Postgres allows 100 in total by default, for everything that connects.", group: "Infrastructure" },
    },
  };
}
