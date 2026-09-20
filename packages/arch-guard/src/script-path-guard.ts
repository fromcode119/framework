/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { FrameworkRoot } from './cli/framework-root';

/**
 * An npm script naming a DIRECTORY that does not exist.
 *
 * Moving a file updates its imports, because the compiler says so. It does NOT update the strings in
 * `package.json`, because nothing reads those until someone runs the script — and a build step that
 * has silently pointed at a deleted path for a week fails at the worst possible moment.
 *
 * It happened while writing this: three directories were moved out of `scripts/` and `build/`, every
 * import was fixed, the typecheck passed, 3,199 tests passed, 37 guards passed — and
 * `build:frontend-runtime` still named the old directory twice. It surfaced only because the exit
 * code was checked by hand afterwards.
 *
 * IT CHECKS THE DIRECTORY, NOT THE FILE, and the difference is the whole guard. Checking files
 * flagged ten paths that scripts GENERATE — a vite config written by a codegen step and deleted after,
 * which does not exist at rest and never should. It also missed the real break, because that token had
 * no extension (`…/frontend-runtime-vite-config`, a module path) and looked like nothing.
 *
 * A directory is the opposite: `packages/frontend/build/` stopped existing the moment the files moved,
 * and every token under it — extension or not, generated or not — is wrong together. Generated files
 * live in directories that DO exist, so they say nothing.
 */
export class ScriptPathGuard {
  /**
   * Only tokens that unambiguously name something in this repository.
   *
   * A shell line is not parseable without a shell: it carries redirections (`>/dev/null`), absolute
   * paths that split on the space in this checkout's own directory name, flags and env assignments. An
   * earlier attempt treated any token with a slash as a path and reported all three as missing
   * directories. Anchoring on the two prefixes that can only mean a repository path removes every one
   * of those without a list of exceptions.
   */
  private static readonly REPO_PATH = /^(packages|config)\/[A-Za-z0-9._@\/-]+$/;

  /** Globs and node_modules are paths, but not ones to resolve literally. */
  private static readonly NOT_RESOLVABLE = /[*?]|(^|\/)node_modules\//;

  /**
   * Where output lands. It does not exist before a build, and a script naming it is not broken.
   *
   * `build` IS NOT IN THIS LIST, and leaving it out is the point. It was, and the guard then skipped
   * every path under a directory called `build` — including the one it was written to catch, which it
   * reported clean twice. That is the same blindness that let a `build/` directory hide nine source
   * files from git and a bootstrap call from every scanner. Output goes to `dist` and `.next`; a
   * directory named `build` is the hazard, not an exemption.
   */
  private static readonly OUTPUT = /(^|\/)(dist|dist-host|\.next|coverage|public\/fc-runtime)\//;

  private static packageFiles(root: string): string[] {
    const found = [path.join(root, 'package.json')];
    const packages = path.join(root, 'packages');

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(packages, { withFileTypes: true });
    } catch {
      return found;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(packages, entry.name, 'package.json');
      if (fs.existsSync(candidate)) found.push(candidate);
    }
    return found;
  }

  /** Every token of every script that looks like a path to a file in this repository. */
  private static pathsIn(scripts: Record<string, string>): Array<{ script: string; token: string }> {
    const found: Array<{ script: string; token: string }> = [];

    for (const [name, line] of Object.entries(scripts)) {
      for (const raw of String(line).split(/[\s'"]+/)) {
        const token = raw.replace(/^[=(]+/, '').replace(/[),;]+$/, '');
        if (!ScriptPathGuard.REPO_PATH.test(token)) continue;
        if (ScriptPathGuard.NOT_RESOLVABLE.test(token)) continue;

        // Always the PARENT. A module path with no extension and a generated file both resolve to the
        // directory that has to exist either way, which is the thing a move actually invalidates.
        const dir = path.dirname(token);
        if (!dir || dir === '.' || ScriptPathGuard.OUTPUT.test(`${dir}/`)) continue;
        found.push({ script: name, token: dir });
      }
    }
    return found;
  }

  static run(): number {
    const root = FrameworkRoot.find();
    const missing: string[] = [];
    let checked = 0;

    for (const file of ScriptPathGuard.packageFiles(root)) {
      let scripts: Record<string, string> = {};
      try {
        scripts = JSON.parse(fs.readFileSync(file, 'utf8')).scripts ?? {};
      } catch {
        continue;
      }

      // RESOLVED AGAINST BOTH the package and the repository root, and missing only when neither has
      // it. A package's scripts run with that package as the working directory, but a tool given a
      // config at the root resolves ITS arguments from there — `vitest run --config ../../… packages/ai`
      // is correct and exists from the root alone. Checking one base invents a failure for the other.
      const bases = [path.dirname(file), root];

      for (const { script, token } of ScriptPathGuard.pathsIn(scripts)) {
        checked++;
        if (bases.some((base) => fs.existsSync(path.resolve(base, token)))) continue;
        missing.push(`  ${path.relative(root, file)}  ${script}\n    ${token}/`);
      }
    }

    console.log(`Directories named by npm scripts, checked: ${checked}.`);
    if (!missing.length) {
      console.log('OK — every directory an npm script names is there.');
      return 0;
    }

    console.log(`\n${missing.length} npm script(s) name a directory that does not exist:\n`);
    for (const entry of missing) console.log(entry);
    console.log('\nA moved file takes its imports with it and leaves these behind. Nothing reads them');
    console.log('until the script runs, which is usually a build.');
    return 1;
  }
}
