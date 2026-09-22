/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { FrameworkRoot } from './cli/framework-root';

/**
 * A runnable script committed to the tree.
 *
 * Not a ban on a file extension — a ban on the SHAPE. A script is something a person or a CI job
 * RUNS: it carries a shebang, or it is a `.sh`. That is what makes it a parallel way of doing things,
 * outside the framework it sits next to:
 *
 *   it is not TYPED      — no compiler sees it, so it rots silently while the code it drives moves on;
 *   it is not TESTED     — nothing collects it, and the one found here had never run in CI at all;
 *   it is not PORTABLE   — these reach for a local topology (`docker exec` into a named container, a
 *                          psql on the host) that exists on one machine and nowhere it is deployed;
 *   it is not GOVERNED   — raw SQL from one skips the tenancy scoping the DB proxy applies, the hooks
 *                          other plugins react to, and the audit trail.
 *
 * Two shapes are deliberately not caught, because they are the answer rather than the problem:
 *
 * A TYPED CLI — a `.ts` entry with a shebang — is what a script should become. The compiler sees it,
 * the test runner can reach it, and it ships with the code it drives. Reporting those would be
 * punishing the fix.
 *
 * A bundler LOADER has no shebang because nothing runs it: a bundler `require`s it through Node's CJS
 * resolver before any TypeScript toolchain exists, which is why it must be `.cjs` and why the ones
 * here are three lines delegating to compiled TypeScript. A module entry point, not a script.
 *
 * Where each kind belongs instead: a static check is a guard, here. An integration exercise is a test.
 * A data repair is a migration, or a command on the CLI, so it runs wherever the code does.
 */
export class LooseScriptGuard {
  /**
   * The platform's own source: the framework and every extension, under one rule.
   *
   * Deliberately NOT the whole checkout. Sibling products (marketplace) and the operator tooling that
   * lives beside them (migration, secrets) are separate concerns with their own repositories and their
   * own reasons; sweeping them up here would be this guard reaching past what it governs.
   */
  private static readonly ROOTS = ['framework/Source', 'plugins', 'themes', 'appearance'] as const;

  /** Walked from each root, so the framework and every extension are covered by one rule. */
  private static readonly SKIP_DIRS = new Set([
    'node_modules', 'dist', 'dist-host', '.next', '.git', 'coverage', 'build', '.turbo',
    // Installed extension payloads and uploads: content this repo receives, not source it owns.
    'data', 'uploads',
  ]);

  /**
   * The one script that cannot be anything else, and why.
   *
   * A container ENTRYPOINT runs as ROOT before node exists, to `chown` bind-mounted volumes the app
   * user cannot make writable for itself. There is no point in that sequence at which a typed program
   * could run instead. Anything added here needs its own reason written beside it.
   */
  private static readonly ALLOWED = new Map<string, string>([
    ['framework/Source/deploy/docker-entrypoint.sh', 'container ENTRYPOINT: runs as root, before node, to chown bind mounts'],
  ]);

  static run(): number {
    const repo = FrameworkRoot.repo();
    const findings: string[] = [];
    let scanned = 0;

    for (const root of LooseScriptGuard.ROOTS) {
      for (const file of LooseScriptGuard.walk(path.resolve(repo, root))) {
        const relative = path.relative(repo, file).split(path.sep).join('/');
        if (!LooseScriptGuard.isScript(file)) continue;
        scanned++;
        if (LooseScriptGuard.ALLOWED.has(relative)) continue;
        findings.push(relative);
      }
    }

    if (findings.length) {
      console.error(`[check-loose-scripts] ${findings.length} runnable script(s) committed to the tree:\n`);
      for (const finding of findings) console.error(`  ${finding}`);
      console.error(
        '\nA script is a parallel way of doing things: untyped, uncollected by any test run, tied to one' +
        '\nmachine, and outside the framework it sits next to.' +
        '\n\n  a static check    -> a guard in packages/arch-guard' +
        '\n  an integration    -> the owning package\'s tests/' +
        '\n  a data repair     -> a migration, or a CLI command' +
        '\n  setup steps       -> the README, run by the reader' +
        '\n\nA bundler loader is not a script and is not reported: nothing RUNS it, a bundler requires it.',
      );
      return 1;
    }

    console.log(`Scanned the tree; ${scanned} runnable script(s) found, ${LooseScriptGuard.ALLOWED.size} declared and allowed.`);
    console.log('OK — no undeclared script is committed.');
    return 0;
  }

  /**
   * `.sh` by extension, an UNTYPED file by shebang — the shape, not the suffix.
   *
   * `.ts` is excluded before the shebang is even read: a typed CLI entry is the shape this guard is
   * pushing work TOWARDS, and catching it would make the fix look like the fault.
   */
  private static isScript(file: string): boolean {
    if (file.endsWith('.sh')) return true;
    if (file.endsWith('.ts') || file.endsWith('.tsx')) return false;
    let handle: number | null = null;
    try {
      handle = fs.openSync(file, 'r');
      const head = Buffer.alloc(2);
      fs.readSync(handle, head, 0, 2, 0);
      return head.toString('utf8') === '#!';
    } catch {
      return false;
    } finally {
      if (handle !== null) try { fs.closeSync(handle); } catch { /* already gone */ }
    }
  }

  private static *walk(dir: string): Generator<string> {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (LooseScriptGuard.SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        yield* LooseScriptGuard.walk(full);
      } else if (entry.isFile()) {
        yield full;
      }
    }
  }
}
