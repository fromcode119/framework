import path from 'node:path';
import { AppTypecheck } from '../app-typecheck';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';
import { GuardTarget } from './guard-target';
import { GuardScope } from './guard-scope';

/**
 * `arch-guard app-typecheck` — real `tsc --noEmit` for the Next apps.
 *
 * `next build` sets `typescript.ignoreBuildErrors`, so a green Docker build proves only that the bundle
 * resolves. This is the actual type gate.
 *
 *   arch-guard app-typecheck                    # error mode (default) — fails above baseline
 *   APP_TYPECHECK_MODE=warn arch-guard …        # report only
 */
export class AppTypecheckCommand extends ArchorCommand {
  readonly summary = 'Real tsc --noEmit for the Next apps (next build does NOT check types).';

  /** Pre-existing debt only. LOWER as it is paid off; never raise to make a build pass. */
  /** The two Next apps this checks. What each is allowed: nothing — see GuardTarget. */
  static readonly APPS = ['admin', 'frontend'] as const;

  run(_argv: string[]): number {
    // The two apps are the framework's, and their tsconfigs include only their own files — no extension
    // is part of this check. A run scoped to one extension therefore type-checked identical framework code
    // every time (about a minute of a three-minute guard job); the framework's own CI runs it on every
    // framework change, which is the only change that can move its result.
    if (GuardScope.isExtension(FrameworkRoot.repo())) {
      console.log('App typecheck skipped: this run guards one extension, and the framework apps are checked by the framework\'s own CI.');
      return 0;
    }
    const framework = FrameworkRoot.find();
    const mode = process.env.APP_TYPECHECK_MODE === 'warn' ? 'warn' : 'error';

    const restore = AppTypecheck.applyExtendedSyntax(path.join(framework, 'packages'));
    process.on('exit', restore);
    process.on('SIGINT', () => { restore(); process.exit(130); });

    let failed = false;
    console.log('App typecheck (real tsc — next build does NOT check types):');
    try {
      for (const app of AppTypecheckCommand.APPS) {
        const count = AppTypecheck.countErrors(framework, `packages/${app}/tsconfig.json`);
        console.log(`  ${app}: ${count} errors${count > GuardTarget.COUNT ? ' — MUST BE 0' : ''}`);
        if (count > GuardTarget.COUNT) failed = true;
      }
    } finally {
      restore();
    }

    if (failed && mode === 'error') {
      console.error('\nApp typecheck FAILED — the app must typecheck with zero errors.');
      return 1;
    }
    console.log(`\nApp typecheck ${failed ? 'reported issues' : 'passed'} (mode=${mode}).`);
    return 0;
  }
}
