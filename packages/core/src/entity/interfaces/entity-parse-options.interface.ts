import { EntityParseMode } from '@core/enums/entity-parse-mode.enum';

export interface IEntityParseOptions {
  mode?: EntityParseMode;
  includeUnknown?: boolean;
  skipReadOnly?: boolean;
  /**
   * System fields (`createdAt`/`updatedAt`) that are normally skipped but should be allowed
   * through because the caller has already authorized a read-only override for them
   * (e.g. an admin unlocked "Created Date" and passed password confirmation). `id` is never allowed.
   */
  allowSystemFields?: string[];
}
