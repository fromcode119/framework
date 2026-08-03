import path from 'node:path';
import { AppTypecheck } from '../app-typecheck';
import { ArchorCommand } from './archor-command';
import { FrameworkRoot } from './framework-root';

/**
 * `archor app-typecheck` — real `tsc --noEmit` for the Next apps.
 *
 * `next build` sets `typescript.ignoreBuildErrors`, so a green Docker build proves only that the bundle
 * resolves. This is the actual type gate.
 *
 *   archor app-typecheck                    # error mode (default) — fails above baseline
 *   APP_TYPECHECK_MODE=warn archor …        # report only
 */
export class AppTypecheckCommand extends ArchorCommand {
  readonly summary = 'Real tsc --noEmit for the Next apps (next build does NOT check types).';

  /** Pre-existing debt only. LOWER as it is paid off; never raise to make a build pass. */
  static readonly BASELINES: Readonly<Record<string, number>> = { admin: 0, frontend: 0 };

  run(_argv: string[]): number {
    const framework = FrameworkRoot.find();
    const mode = process.env.APP_TYPECHECK_MODE === 'warn' ? 'warn' : 'error';

    const restore = AppTypecheck.applyExtendedSyntax(path.join(framework, 'packages'));
    process.on('exit', restore);
    process.on('SIGINT', () => { restore(); process.exit(130); });

    let failed = false;
    console.log('App typecheck (real tsc — next build does NOT check types):');
    try {
      for (const [app, baseline] of Object.entries(AppTypecheckCommand.BASELINES)) {
        const count = AppTypecheck.countErrors(framework, `packages/${app}/tsconfig.json`);
        console.log(`  ${app}: ${count} errors (baseline ${baseline})`);
        if (count > baseline) {
          failed = true;
          console.error(`  ${app}: ${count} type errors — ABOVE baseline ${baseline} (+${count - baseline} NEW).`);
        } else if (count < baseline) {
          console.log(`  ${app}: below baseline — LOWER it to ${count}.`);
        }
      }
    } finally {
      restore();
    }

    if (failed && mode === 'error') {
      console.error('\nApp typecheck FAILED — you introduced new type errors. Fix them, or explain why the baseline must change.');
      return 1;
    }
    console.log(`\nApp typecheck ${failed ? 'reported issues' : 'passed'} (mode=${mode}).`);
    return 0;
  }
}
