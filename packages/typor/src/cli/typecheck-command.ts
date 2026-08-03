import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { TyporSyntaxPlugin } from '../typor-syntax-plugin';
import { SourceWalk } from './source-walk';
import { TyporCommand } from './typor-command';
import { WorkspaceRoot } from './workspace-root';

/**
 * `typor typecheck <packageDir> [--tsconfig tsconfig.json]` — typecheck a package whose source uses
 * typor's extended syntax.
 *
 * `tsc` cannot parse a multi-base `extends`, so the affected files are rewritten IN PLACE, tsc runs, and
 * the originals are restored in a `finally`. In-place (rather than a shadow copy) because packages
 * resolve `@/…` aliases and project references against their real location — a mirror silently breaks
 * both. The rewrite is line-preserving, so every diagnostic's line/column is accurate for the real file.
 */
export class TypecheckCommand extends TyporCommand {
  readonly summary = 'Typecheck a package using typor extended syntax <pkgDir> [--tsconfig x].';

  run(argv: string[]): number {
    const pkgDir = path.resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : process.cwd());
    const workspace = WorkspaceRoot.find(pkgDir);
    const tsconfig = argv.includes('--tsconfig') ? argv[argv.indexOf('--tsconfig') + 1] : 'tsconfig.json';

    // Transform the WHOLE workspace: the package under test may import extended-syntax files from a sibling.
    const originals = new Map<string, string>();
    const restore = (): void => {
      for (const [f, s] of originals) writeFileSync(f, s, 'utf8');
      originals.clear();
    };
    process.on('exit', restore);
    process.on('SIGINT', () => { restore(); process.exit(130); });

    try {
      for (const file of SourceWalk.files(path.join(workspace, 'packages'))) {
        const source = readFileSync(file, 'utf8');
        if (!TyporSyntaxPlugin.handles(source)) continue;
        originals.set(file, source);
        writeFileSync(file, TyporSyntaxPlugin.transform(source), 'utf8');
      }
      const tsc = path.join(workspace, 'node_modules/.bin/tsc');
      const run = spawnSync(tsc, ['--noEmit', '-p', path.join(pkgDir, tsconfig)], { encoding: 'utf8', cwd: workspace });
      process.stdout.write((run.stdout || '') + (run.stderr || ''));
      return run.status ?? 0;
    } finally {
      restore();
    }
  }
}
