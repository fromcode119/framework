import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { ColumnGuard } from '../helpers/column-guard';

/**
 * A build can install what it produced, and updating something already running is a separate yes.
 *
 * Before this column there was no way to say "put it in place" at all. `auto_update` was the only
 * install switch, it ran only on the scheduled path, and the admin forced it off unless automatic
 * building was on — so pressing Build produced a package and left it in the workspace. The button
 * did half a job and nothing said which half.
 *
 * The two are now different questions. `install_after_build` covers putting a package where none is
 * installed, which is additive; `auto_update` covers REPLACING code that is currently serving a
 * site, which is not, and keeps its own switch for that reason. Neither depends on `auto_build`.
 *
 * TRUE for existing rows as well as new ones, stated rather than left to the column default: a
 * default applies only to rows written after it exists, and an operator who added a source to have
 * it built meant for the result to arrive. Same reasoning as migration 034's `provider` backfill.
 */
export class SourcesInstallAfterBuildMigration extends BaseMigration {
  readonly version = 35;
  readonly name = 'A built source installs itself unless told not to';

  private static readonly TABLE = 'fcp_sources_builds';

  async up(db: IDatabaseManager): Promise<void> {
    await ColumnGuard.addIfMissing(
      db,
      SourcesInstallAfterBuildMigration.TABLE,
      'install_after_build',
      'BOOLEAN DEFAULT TRUE',
    );
    await db.execute(sql.raw(
      `UPDATE ${SourcesInstallAfterBuildMigration.TABLE} SET install_after_build = TRUE WHERE install_after_build IS NULL`,
    ));
  }
}
