import path from 'node:path';
import { MiddlewareGlueGenerator } from '../middleware-glue-generator';
import { NextorCommand } from './nextor-command';

/**
 * `nextor verify-middleware <pkgDir> [<pkgDir> …]` — fail when middleware glue is left in the tree.
 *
 * Next's middleware entry cannot be a class (its own source CALLS the export, and a class throws when
 * invoked without `new`), so the glue carries `export const`. It is therefore generated only for the
 * duration of a Next command and deleted afterwards — see `with-middleware`. This guard asserts the file
 * is ABSENT; a leftover copy means an interrupted build, or someone writing the non-class exports back
 * into the tree by hand.
 */
export class VerifyMiddlewareCommand extends NextorCommand {
  readonly summary = 'Fail when generated middleware glue is left in the tree <pkgDir…>.';

  run(argv: string[]): number {
    const targets = argv.length ? argv : [process.cwd()];

    let failed = 0;
    for (const dir of targets) {
      const packageDir = path.resolve(dir);
      const complaint = MiddlewareGlueGenerator.verify(packageDir);
      if (!complaint) continue;
      console.error(`[nextor] ${path.basename(packageDir)}: ${complaint}`);
      failed += 1;
    }

    if (failed) {
      console.error('[nextor] the tree must contain only the authored class — the glue is transient build output.');
      return 1;
    }
    console.log(`[nextor] no middleware glue in the tree (${targets.length} package(s)) — class only.`);
    return 0;
  }
}
