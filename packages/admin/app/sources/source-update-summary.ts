import type { ISourceUpdateCheck } from '@/app/sources/interfaces/source-update-check.interface';

/**
 * What "Check Updates" found, in words the operator can act on.
 *
 * The check used to be sent and its answer discarded: the list reloaded looking exactly as before, so
 * a branch with new commits was indistinguishable from one without. The answer names each moved
 * source, and says which of them the scheduled run will build and which wait for Build.
 */
export class SourceUpdateSummary {
  constructor(private readonly check: ISourceUpdateCheck, private readonly builds: any[]) {}

  get hasUpdates(): boolean {
    return this.changed().length > 0;
  }

  get title(): string {
    const count = this.changed().length;
    if (count === 0) return 'Everything is up to date';
    return count === 1 ? '1 source has new commits' : `${count} sources have new commits`;
  }

  get message(): string {
    const changed = this.changed();
    if (changed.length === 0) {
      const total = this.check.updates.length;
      return total === 1 ? 'The one source matches its tracked branch.' : `All ${total} sources match their tracked branch.`;
    }

    const automatic = changed.filter((update) => this.buildOf(update)?.autoBuild);
    const manual = changed.filter((update) => !this.buildOf(update)?.autoBuild);
    const parts: string[] = [];
    if (automatic.length > 0) {
      parts.push(`Built automatically on the next scheduled run: ${SourceUpdateSummary.names(automatic)}.`);
    }
    if (manual.length > 0) {
      parts.push(`Not set to build automatically — press Build: ${SourceUpdateSummary.names(manual)}.`);
    }
    return parts.join(' ');
  }

  private changed(): ISourceUpdateCheck['updates'] {
    return this.check.updates.filter((update) => update.hasUpdate);
  }

  private buildOf(update: ISourceUpdateCheck['updates'][number]): any {
    return this.builds.find((build) => String(build?.type) === update.type && String(build?.slug) === update.slug);
  }

  /** `slug (type)`: a plugin and a theme can share a slug, and the list shows both. */
  private static names(updates: ISourceUpdateCheck['updates']): string {
    return updates.map((update) => `${update.slug} (${update.type})`).join(', ');
  }
}
