import { TenantArchiveManifest } from '@core/tenant/provisioning/tenant-archive-manifest';

/**
 * What an import WOULD do — shown to the operator before anything is written.
 *
 * Every line of it is a fact read from the archive or the platform, not a guess: which tables will
 * keep their ids and which will be re-numbered (and why), which plugins/themes the archive expects
 * that this platform lacks, which users already exist here, which JSON columns the remap will NOT
 * follow. `blockers` are the reasons the import is refused outright; `warnings` are things it will
 * do that the operator should know.
 */
export class TenantImportPlan {
  constructor(
    readonly manifest: TenantArchiveManifest,
    readonly tables: Array<{
      name: string;
      rows: number;
      mode: 'preserve' | 'remap' | 'skip';
      /**
       * WHY the mode was chosen, as a token rather than a sentence.
       *
       * It used to be prose, which meant the two numbers the decision actually turns on existed only
       * inside a sentence — so every re-numbered table repeated the same words to say something the
       * `mode` had already said, and nothing could render the numbers on their own. The sentence is
       * generic by construction; it belongs once, above the group. `minId`/`taken` are what differ.
       */
      basis: 'noTable' | 'naturalKey' | 'empty' | 'aboveSequence' | 'belowSequence';
      /** Lowest id in the archive. `null` when the table has no serial id, or no rows. */
      minId: number | null;
      /** Highest id this platform has already handed out for this table. `null` with no serial id. */
      taken: number | null;
      /** JSON columns whose embedded ids the remap cannot follow — only meaningful in `remap` mode. */
      opaqueJsonColumns: string[];
      /** Archive columns this platform's table does not have; their values are dropped. */
      droppedColumns: string[];
    }>,
    readonly plugins: Array<{ slug: string; archiveVersion: string; installedVersion: string | null; enabled: boolean }>,
    readonly theme: { slug: string; archiveVersion: string; installedVersion: string | null } | null,
    readonly users: { total: number; existing: number; toCreate: number },
    readonly files: { count: number; bytes: number; colliding: number },
    readonly blockers: string[],
    readonly warnings: string[],
  ) {}

  get canExecute(): boolean {
    return this.blockers.length === 0;
  }

  get remappedTables(): string[] {
    return this.tables.filter((table) => table.mode === 'remap').map((table) => table.name);
  }

  toJSON(): Record<string, unknown> {
    return {
      manifest: this.manifest.toJSON(),
      tables: this.tables,
      plugins: this.plugins,
      theme: this.theme,
      users: this.users,
      files: this.files,
      blockers: this.blockers,
      warnings: this.warnings,
      canExecute: this.canExecute,
    };
  }
}
