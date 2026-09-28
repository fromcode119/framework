import fs from 'node:fs';
import path from 'node:path';
import { ChangelogDocument } from '../changelog/changelog-document';
import { ChangelogHistory } from '../changelog/changelog-history';
import type { IChangelogRelease } from '../changelog/interfaces/changelog-release.interface';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';
import { GuardScope } from './guard-scope';

/**
 * `arch-guard changelog` — the framework's CHANGELOG.md has a section for the version it is about to be.
 *
 *   arch-guard changelog            # check (CI): fails when package.json's version has no section
 *   arch-guard changelog --write    # rebuild CHANGELOG.md from the release tags and commits
 *
 * The changelog stopped at a hand-written 2.0.0 while 299 tagged releases went out, because nothing ever
 * asked for it. The check makes a release PR — the one that bumps the version — fail until the section
 * exists, and `--write` produces it from the commits since the last tag, so keeping it is one command.
 *
 * The check reads only the two files, so it works on a shallow CI checkout. `--write` needs the history
 * and the tags. A plugin, theme or appearance run skips it: their changelogs are their own.
 */
export class ChangelogCommand extends ArchorCommand {
  readonly summary = 'CHANGELOG.md has a section for the current version (--write rebuilds it from git).';

  static readonly FILE = 'CHANGELOG.md';

  run(argv: string[]): number {
    if (GuardScope.isExtension()) {
      console.log('Changelog: an extension scope keeps its own changelog — skipped.');
      return 0;
    }
    const root = FrameworkRoot.find();
    const file = path.join(root, ChangelogCommand.FILE);
    const version = ChangelogCommand.version(root);
    return argv.includes('--write') ? ChangelogCommand.write(root, file, version) : ChangelogCommand.check(file, version);
  }

  private static check(file: string, version: string): number {
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (ChangelogDocument.hasSection(content, version)) {
      console.log(`Changelog has a section for ${version}.`);
      return 0;
    }
    console.log(`CHANGELOG.md has no section for ${version} (package.json). Run \`npm run changelog:write\` and commit it with the release.`);
    return 1;
  }

  private static write(root: string, file: string, version: string): number {
    const history = new ChangelogHistory(root);
    const releases: IChangelogRelease[] = history.releases();
    const latest = releases.length ? releases[releases.length - 1].version : '';
    const pending = history.sinceLatest(latest);
    if (version && version !== latest) {
      // The release being prepared: its tag is created when this PR merges, so its commits are the ones since the last tag.
      releases.push({ version, date: new Date().toISOString().slice(0, 10), subjects: pending });
    } else if (pending.length) {
      releases.push({ version: ChangelogDocument.UNRELEASED, date: '', subjects: pending });
    }
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const rendered = new ChangelogDocument(history.repositoryUrl()).render(releases, ChangelogDocument.legacyOf(existing));
    fs.writeFileSync(file, rendered);
    console.log(`CHANGELOG.md rebuilt: ${releases.length} sections, newest ${releases[releases.length - 1]?.version || '(none)'}.`);
    return 0;
  }

  private static version(root: string): string {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version?: string };
    return String(manifest.version ?? '').trim();
  }
}
