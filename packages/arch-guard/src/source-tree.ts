/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { GuardScope } from './cli/guard-scope';
import { FrameworkRoot } from './cli/framework-root';

/**
 * Walking the source trees a guard checks — plugins, themes, appearance and the framework itself.
 *
 * It exists because four guards were, until now, four standalone `.cjs` files outside the repository
 * that each re-implemented this walk with a slightly different exclusion list. They were untracked:
 * `CLAUDE.md` told people to run three of them and nothing in version control contained them.
 *
 * The areas come from `GuardScope`, which REFUSES a scope that resolves to nothing. That matters more
 * than it sounds: one of the ported scanners aborted its walk of a whole directory on hitting a file
 * whose name matched an exclusion (a `return` where a `continue` was meant), so it reported clean over
 * code it never opened. A walker nobody can point a wrong root at is the structural version of the
 * same fix.
 */
export class SourceTree {
  /** Build output, dependencies and generated trees — never the subject of a naming rule. */
  private static readonly SKIP_DIRS = new Set([
    'node_modules', 'dist', '.next', '.git', 'build', 'coverage', '.turbo',
  ]);

  /** The roots every naming guard reads, as `GuardScope` resolves them for this checkout. */
  static areas(): { area: string; dir: string }[] {
    return GuardScope.areas(FrameworkRoot.repo());
  }

  /**
   * Every file under `dir` whose name passes `matches`, depth-first.
   *
   * `skip` names ADDITIONAL directories to leave out, per guard — an i18n scan wants `ui-ssr` out,
   * a property-access scan wants `migrations` and `seeds` out. A directory is skipped by NAME here
   * and a file is filtered by `matches`; conflating the two is what produced the aborted-walk bug,
   * where a FILE name ended the directory.
   */
  static files(dir: string, matches: (name: string) => boolean, skip: ReadonlySet<string> = new Set()): string[] {
    const found: string[] = [];

    const walk = (at: string): void => {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(at, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (SourceTree.SKIP_DIRS.has(entry.name) || skip.has(entry.name)) continue;
          walk(path.join(at, entry.name));
          continue;
        }
        if (matches(entry.name)) found.push(path.join(at, entry.name));
      }
    };

    walk(dir);
    return found;
  }

  /** Every `.ts`/`.tsx` file across every area. */
  static typescript(skip: ReadonlySet<string> = new Set()): string[] {
    return SourceTree.areas().flatMap(({ dir }) => SourceTree.files(dir, (name) => /\.tsx?$/.test(name), skip));
  }

  /** A path as a reader would cite it, relative to where the command was run. */
  static cite(file: string): string {
    return path.relative(process.cwd(), file);
  }

  /** Lines of a file, or none when it cannot be read — a guard never dies on one unreadable file. */
  static lines(file: string): string[] {
    try {
      return fs.readFileSync(file, 'utf8').split('\n');
    } catch {
      return [];
    }
  }

  /** Whether a line is a comment — every naming rule here is about code, not prose about code. */
  static isComment(line: string): boolean {
    return /^\s*(\/\/|\*|\/\*)/.test(line);
  }
}
