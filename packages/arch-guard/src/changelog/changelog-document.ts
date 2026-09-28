import type { IChangelogRelease } from './interfaces/changelog-release.interface';

/**
 * Renders `CHANGELOG.md` from the release history — Keep a Changelog, newest first, one section per version.
 *
 * Commit subjects are grouped by their conventional-commit type. Only what a user of the framework would
 * notice is listed: features, fixes, performance, security, reverts, and subjects that carry no type at all.
 * Release bumps, CI, tests, docs, formatting, build glue and refactors are left out — they are real work,
 * but a changelog that lists them buries the changes someone upgrading needs to read.
 *
 * The hand-written entries that predate the tagged series are kept verbatim below {@link LEGACY_MARKER}.
 */
export class ChangelogDocument {
  /** Commits since the newest tag while the version has not moved yet — undated, as Keep a Changelog has it. */
  static readonly UNRELEASED = 'Unreleased';

  static readonly LEGACY_MARKER = '<!-- Entries below predate the tagged v0.x releases and were written by hand. -->';

  private static readonly SUBJECT = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;
  private static readonly PR = /\s*\(#(\d+)\)\s*$/;
  /** Type → section, in the order sections are printed. A type not listed here is not user-facing. */
  private static readonly SECTIONS: ReadonlyArray<[string, readonly string[]]> = [
    ['Security', ['security', 'sec']],
    ['Added', ['feat', 'feature']],
    ['Fixed', ['fix', 'bugfix', 'hotfix']],
    ['Performance', ['perf']],
    ['Reverted', ['revert']],
  ];
  private static readonly UNTYPED = 'Changed';

  constructor(private readonly repositoryUrl: string) {}

  render(releases: IChangelogRelease[], legacy: string): string {
    const sections = [...releases].reverse().map((release) => this.section(release)).join('\n');
    const tail = legacy.trim() ? `\n---\n\n${ChangelogDocument.LEGACY_MARKER}\n\n${legacy.trim()}\n` : '';
    return `${ChangelogDocument.HEADER}\n${sections}${tail}`;
  }

  /** The hand-written history to carry over: after the marker once written, else everything from the first entry. */
  static legacyOf(existing: string): string {
    const marker = existing.indexOf(ChangelogDocument.LEGACY_MARKER);
    if (marker !== -1) return existing.slice(marker + ChangelogDocument.LEGACY_MARKER.length);
    const first = existing.search(/^## \[/m);
    return first === -1 ? '' : existing.slice(first);
  }

  /** Whether the file has a section for this version. */
  static hasSection(content: string, version: string): boolean {
    return content.includes(`## [${version}]`);
  }

  private section(release: IChangelogRelease): string {
    const groups = new Map<string, string[]>();
    for (const subject of release.subjects) {
      const entry = this.entry(subject);
      if (!entry) continue;
      groups.set(entry.section, [...(groups.get(entry.section) ?? []), entry.line]);
    }
    const order = [...ChangelogDocument.SECTIONS.map(([name]) => name), ChangelogDocument.UNTYPED];
    const body = order
      .filter((name) => groups.has(name))
      .map((name) => `### ${name}\n\n${groups.get(name)!.join('\n')}\n`)
      .join('\n');
    const heading = release.version === ChangelogDocument.UNRELEASED ? `## [${release.version}]` : `## [${release.version}] - ${release.date}`;
    return `${heading}\n\n${body || '_No user-facing changes._\n'}`;
  }

  private entry(subject: string): { section: string; line: string } | null {
    const parsed = ChangelogDocument.SUBJECT.exec(subject);
    if (!parsed) return { section: ChangelogDocument.UNTYPED, line: this.line('', subject, false) };
    const [, type, scope = '', breaking, text] = parsed;
    const section = ChangelogDocument.SECTIONS.find(([, types]) => types.includes(type.toLowerCase()))?.[0];
    return section ? { section, line: this.line(scope, text, Boolean(breaking)) } : null;
  }

  private line(scope: string, text: string, breaking: boolean): string {
    const pr = ChangelogDocument.PR.exec(text);
    const description = pr ? text.slice(0, pr.index) : text;
    const link = pr ? (this.repositoryUrl ? ` ([#${pr[1]}](${this.repositoryUrl}/pull/${pr[1]}))` : ` (#${pr[1]})`) : '';
    return `- ${breaking ? '**BREAKING** ' : ''}${scope ? `**${scope}**: ` : ''}${description.trim()}${link}`;
  }

  private static readonly HEADER = [
    '# Changelog',
    '',
    'All notable changes to the Fromcode framework, one section per release, newest first.',
    '',
    'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Every section is built from',
    'the commits between two release tags (`npm run changelog:write`), and the build fails a release whose',
    'version has no section (`npm run check:changelog`). To say more about a change, say it in the PR title.',
    '',
  ].join('\n');
}
