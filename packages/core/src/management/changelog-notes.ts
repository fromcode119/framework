/**
 * What one release changed, read from the repository's CHANGELOG.md.
 *
 * The changelog is written at release time from the titles of the pull requests that merged
 * (`## [0.2.391] - 2026-10-14`, then `### Fixed` and one bullet per change), so it is the project's own
 * record of each release. The update screen shows it as plain text, so markdown is folded away:
 * `**scope**:` becomes `scope:` and `[#929](https://…)` becomes `#929`.
 */
export class ChangelogNotes {
  /** The notes for `version`, or `''` when the changelog has no section for it. */
  static section(changelog: string, version: string): string {
    const lines = String(changelog || '').split('\n');
    const header = `## [${String(version).replace(/^v/, '')}]`;
    const start = lines.findIndex((line) => line.startsWith(header));
    if (start === -1) return '';

    const body: string[] = [];
    for (const line of lines.slice(start + 1)) {
      if (line.startsWith('## ')) break;
      body.push(ChangelogNotes.plain(line));
    }
    return body.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /** One changelog line as plain text: headings lose their marks, bullets keep theirs, links keep their words. */
  private static plain(line: string): string {
    return line
      .replace(/^#{1,6}\s+/, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .trimEnd();
  }
}
