import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * The addresses the gateway stopped as scanners, so a stop is seen in the console and outlives a
 * gateway restart.
 *
 * One row per stop: the address, why, when it started and ends, what it asked for, which sites it
 * tried, and how many requests were refused while it lasted. `released_at` is set when an operator lets
 * it go early (or blocks it for good, which moves it to the blocked addresses). Platform-level, like the
 * certificates: a stop covers every site on the platform, so there is no tenant to scope it to.
 */
export class EdgeStopsMigration extends BaseMigration {
  readonly version = 73;
  readonly name = 'Stopped addresses';
  /** Only a new table: the running release never reads it. */
  readonly rollingSafe = true;

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_edge_stops (
        id ${type.autoId},
        address ${type.shortText} NOT NULL,
        reason ${type.shortText} NOT NULL,
        strikes INTEGER NOT NULL DEFAULT 0,
        refused INTEGER NOT NULL DEFAULT 0,
        hosts ${type.json},
        paths ${type.json},
        stopped_at ${type.timestamp} DEFAULT ${type.now},
        until_at ${type.timestamp},
        released_at ${type.timestamp},
        released_by ${type.shortText},
        release_action ${type.shortText}
      )`,
    ));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_edge_stops_address ON _system_edge_stops (address)'));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_edge_stops_until ON _system_edge_stops (until_at)'));
  }
}
