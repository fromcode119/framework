import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { ColumnGuard } from '../helpers/column-guard';

/**
 * Records WHICH provider fetches each source.
 *
 * Until now the answer was git, everywhere, implicitly — the columns are called `git_url` and
 * `git_secret`, and the code shelled out to `git`. That is not a choice anything recorded; it is an
 * assumption, and an assumption cannot be changed per source.
 *
 * `'git'` as the default is a statement about the existing rows rather than a guess: every source
 * that predates this column was fetched by cloning a repository, because nothing else existed.
 * New rows carry whatever the operator picked.
 *
 * The git-named columns keep their names. Renaming them to `location`/`secret` is the right shape and
 * the wrong migration to bundle here: it would rewrite the table every deployment reads, for a
 * cosmetic gain, in the same release that changes how sources are fetched.
 */
export class SourcesProviderColumnMigration extends BaseMigration {
  readonly version = 34;
  readonly name = 'Each source records the provider that fetches it';

  private static readonly TABLE = 'fcp_sources_builds';

  async up(db: IDatabaseManager): Promise<void> {
    await ColumnGuard.addIfMissing(db, SourcesProviderColumnMigration.TABLE, 'provider', "TEXT DEFAULT 'git'");
    // The default only applies to rows written after it exists, so existing ones are stated too —
    // a NULL provider would read as "unknown", and the build refuses an unknown provider by design.
    await db.execute(sql.raw(
      `UPDATE ${SourcesProviderColumnMigration.TABLE} SET provider = 'git' WHERE provider IS NULL OR provider = ''`,
    ));
  }
}
