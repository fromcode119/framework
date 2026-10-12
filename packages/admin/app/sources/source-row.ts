import type { ISourceUpdateCheck } from '@/app/sources/interfaces/source-update-check.interface';

/**
 * One source as the Sources table shows it: the stored record, plus whether the last update check
 * found commits it has not built.
 *
 * Identified by KIND and slug together: the same slug can name a plugin, a theme and an appearance,
 * and an id built from the slug alone would expand, build or remove whichever rendered first.
 */
export class SourceRow {
  constructor(readonly build: any, readonly hasNewCommits: boolean) {}

  /** `check` is the answer of the last "Check updates" press, or null when none was pressed. */
  static from(build: any, check: ISourceUpdateCheck | null): SourceRow {
    const type = String(build?.type ?? '');
    const slug = String(build?.slug ?? '');
    const update = check?.updates.find((entry) => entry.type === type && entry.slug === slug);
    return new SourceRow(build, Boolean(update?.hasUpdate));
  }

  get id(): string {
    return `${this.type}/${this.slug}`;
  }

  get type(): string {
    return String(this.build?.type ?? '');
  }

  get slug(): string {
    return String(this.build?.slug ?? '');
  }

  /** `pending` until the first build reports, which is what the server records for a new source. */
  get status(): string {
    return String(this.build?.lastBuildStatus || 'pending');
  }

  get version(): string {
    return String(this.build?.version ?? '').trim();
  }

  get branch(): string {
    return String(this.build?.branch ?? '').trim();
  }

  /** The newest line of what changed in the last build, or '' when no build recorded one. */
  get lastChange(): string {
    return String(this.build?.changelog ?? '').split('\n').map((line) => line.trim()).find((line) => line !== '') ?? '';
  }

  /** The repository without the scheme and `.git`: every row said the same prefix before the part that differs. */
  get repository(): string {
    return String(this.build?.gitUrl ?? '').trim().replace(/^https?:\/\/(www\.)?/, '').replace(/\.git$/, '');
  }

  /** Anything an operator should look at: a build that did not succeed, or commits waiting to be built. */
  get needsAttention(): boolean {
    return this.status !== 'success' || this.hasNewCommits;
  }

  /** Search matches the name, the kind and the repository, case-insensitively. */
  matches(search: string): boolean {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [this.slug, this.type, this.repository].some((value) => value.toLowerCase().includes(needle));
  }
}
