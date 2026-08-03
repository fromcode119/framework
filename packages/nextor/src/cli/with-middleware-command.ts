import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { MiddlewareGlueGenerator } from '../middleware-glue-generator';
import { NextorCommand } from './nextor-command';

/**
 * `nextor with-middleware -- <command> [args…]` — run a Next command with the middleware glue present,
 * then REMOVE it.
 *
 * Next's middleware entry cannot be a class. Its own source settles it: `build/templates/middleware.js`
 * resolves `mod.proxy || mod.default` and invokes `fn(...args)`, so the exported binding has to be a
 * callable function — a `class` binding throws "cannot be invoked without 'new'". And
 * `build/analysis/get-page-static-info.js` accepts only a default export, a `proxy` function/variable
 * declaration, or `export { X as proxy }`. There is no form of `export class` that satisfies both.
 *
 * What IS avoidable is the file living in the authored tree. `next build` only needs it while it scans
 * `rootDir` for `proxy.<pageExtension>`; the artifact it serves afterwards is compiled into `.next`. So
 * the glue is generated, the command runs, and the glue is deleted in a `finally` — the same contract
 * `typor build` uses when it rewrites sources for tsc and restores them. Interrupt the build and the
 * file still goes away.
 *
 * Net effect: the only middleware file in the tree is `proxy-route.ts`, which is an `export class`.
 */
export class WithMiddlewareCommand extends NextorCommand {
  readonly summary = 'Run a Next command with middleware glue present, then remove it -- <cmd…>.';

  run(argv: string[]): Promise<number> | number {
    const separator = argv.indexOf('--');
    const command = separator === -1 ? [] : argv.slice(separator + 1);
    if (!command.length) {
      console.error('usage: nextor with-middleware -- <command> [args...]');
      return 2;
    }

    const packageDir = process.cwd();
    const generated = MiddlewareGlueGenerator.generate(packageDir);
    if (generated) {
      console.log(`[nextor] generated ${path.relative(packageDir, generated)} (removed when this command exits)`);
    }

    const cleanup = (): void => WithMiddlewareCommand.cleanup(generated, packageDir);

    // A signal must still clean up: `next dev` is normally ended with Ctrl-C, and leaving the glue behind
    // would put a non-class export back in the tree — exactly what this exists to prevent.
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      process.on(signal, () => {
        cleanup();
        process.exit(signal === 'SIGINT' ? 130 : 143);
      });
    }
    process.on('exit', cleanup);

    return new Promise<number>((resolve) => {
      const child = spawn(command[0], command.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
      child.on('exit', (code, signal) => {
        cleanup();
        resolve(signal ? 1 : code ?? 0);
      });
      child.on('error', (error: Error) => {
        cleanup();
        console.error(`[nextor] failed to run ${command.join(' ')}: ${error.message}`);
        resolve(1);
      });
    });
  }

  /** Delete the glue. Idempotent, and never allowed to mask the command's own exit code. */
  private static cleanup(generated: string | null | undefined, packageDir: string): void {
    if (!generated || !existsSync(generated)) return;
    try {
      unlinkSync(generated);
      console.log(`[nextor] removed ${path.relative(packageDir, generated)} — the tree keeps only the class`);
    } catch (error) {
      console.error(`[nextor] could not remove ${generated}: ${(error as Error).message}`);
    }
  }
}
