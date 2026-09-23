/**
 * Refuses a database that stopped part-way through the framework migrations that were consolidated.
 *
 * Versions 1–52 were merged into nine migrations, each keeping the number of one of the versions it
 * replaced. The runner skips a migration whose version is already recorded, which is exactly right for
 * the two cases that exist: a fresh database runs all nine, and a database that ran 1–52 has every
 * kept number recorded and runs none. A database recorded at, say, 30 is the third case, and it would
 * go wrong silently: the migrations kept at 19 and below would be skipped while the work they absorbed
 * from 20–30 was never done, and everything consolidated above 30 would run on top of a schema it does
 * not expect.
 *
 * So that case stops, before anything runs, and says what to do: upgrade through the last release that
 * still shipped the individual migrations, then through this one.
 */
export class MigrationConsolidationGuard {
  /** The highest framework migration version the consolidation replaced. */
  static readonly CONSOLIDATED_THROUGH = 52;

  /** The last release that shipped migrations 1–52 individually. */
  static readonly LAST_UNCONSOLIDATED_RELEASE = 'v0.2.162';

  /**
   * @param executed the rows already recorded in the migrations table (`name`, `version`).
   * @throws when framework migrations were recorded but stopped short of the consolidated range.
   */
  static assertComplete(executed: ReadonlyArray<{ name?: unknown; version?: unknown }>): void {
    const framework = executed
      .filter((row) => !String(row?.name ?? '').startsWith('plugin:'))
      .map((row) => Number(row?.version))
      .filter((version) => Number.isFinite(version));
    if (!framework.length) return;

    const reached = Math.max(...framework);
    if (reached >= MigrationConsolidationGuard.CONSOLIDATED_THROUGH) return;

    throw new Error(
      `This database stopped at framework migration ${reached}. Migrations 1–`
      + `${MigrationConsolidationGuard.CONSOLIDATED_THROUGH} have since been consolidated, and running the `
      + `consolidated set on top of a partial schema would skip work silently. Upgrade to `
      + `${MigrationConsolidationGuard.LAST_UNCONSOLIDATED_RELEASE} first, let it migrate to `
      + `${MigrationConsolidationGuard.CONSOLIDATED_THROUGH}, then upgrade to this release.`,
    );
  }
}
