#!/usr/bin/env node
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

/**
 * The `atlantis-admin` binary: runs the Next admin panel from its own package directory.
 *
 * It exists because `next` must be started with THIS package as its cwd — installed globally, via
 * npx, or as a workspace dependency, the admin's `.next` build and its config live here, not
 * wherever the operator happened to be standing. Resolving the `next` binary relative to this
 * directory rather than the caller's is the whole job.
 *
 * It was a hand-written CommonJS script, which is why nothing checked it: every OOP and typecheck
 * guard filters on `/\.tsx?$/`, so a `.js` entry point is invisible to all of them. It is compiled
 * to `dist/bin.js` now, so the source is typed and guarded and only the build output is `.js`.
 */
export class AdminLauncher {
  /** Where this package is, resolved from the compiled file's own location. */
  private static get packageDirectory(): string {
    return path.resolve(__dirname, '..');
  }

  /** `ADMIN_PORT`, else `PORT`, else the admin's conventional port. */
  private static get port(): string {
    return process.env.ADMIN_PORT || process.env.PORT || '3001';
  }

  /**
   * The `next` binary belonging to THIS package.
   *
   * A missing one is an install problem, not a crash: it is reported as the one action that fixes
   * it rather than as a module-resolution stack trace.
   */
  private static resolveNextBinary(): string {
    const requireFrom = createRequire(path.join(AdminLauncher.packageDirectory, 'package.json'));
    try {
      return requireFrom.resolve('next/dist/bin/next');
    } catch {
      console.error('[atlantis-admin] Could not resolve the "next" binary. Run: npm install inside @fromcode119/admin');
      process.exit(1);
    }
  }

  /** `next start` in production, `next dev` otherwise — bound to all interfaces so a container can serve it. */
  private static argumentsFor(nextBin: string): string[] {
    const port = AdminLauncher.port;
    return process.env.NODE_ENV === 'production'
      ? [nextBin, 'start', '-p', port]
      : [nextBin, 'dev', '--webpack', '-H', '0.0.0.0', '-p', port];
  }

  /** Process entry: replace this process with Next's, and carry its exit code back out. */
  static main(): void {
    const child = spawn(process.execPath, AdminLauncher.argumentsFor(AdminLauncher.resolveNextBinary()), {
      cwd: AdminLauncher.packageDirectory,
      stdio: 'inherit',
      env: { ...process.env, PORT: AdminLauncher.port },
    });
    child.on('exit', (code) => process.exit(code ?? 0));
  }
  /**
   * Runs on class initialisation.
   *
   * A bare `AdminLauncher.main()` after the class would be a module-level call, which this codebase
   * does not allow in an entry file. `ProcessEntry` is the framework's decorator for exactly
   * this, but importing it here pulls the whole of core into a standalone binary — measured at
   * 1.66 MB against 3.7 KB — so the entry stays dependency-free and self-starts instead.
   */
  static {
    AdminLauncher.main();
  }
}
