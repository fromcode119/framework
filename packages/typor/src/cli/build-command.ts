import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { AliasEmitRewrite } from '../alias-emit-rewrite';
import { TyporSyntaxPlugin } from '../typor-syntax-plugin';
import { SourceWalk } from './source-walk';
import { TyporCommand } from './typor-command';
import { WorkspaceRoot } from './workspace-root';

/**
 * `typor build [tsc args…]` — run `tsc` over sources that use typor's extended syntax.
 *
 * `tsc` cannot parse `class X extends A, B`. Mirroring the tree defeats project references and workspace
 * symlinks, so instead the affected files are rewritten IN PLACE, the build runs, and the originals are
 * restored in a `finally` — so an interrupted build can never leave transformed source behind.
 *
 * Only files that actually use the extended syntax are touched, and the rewrite is line-preserving, so
 * diagnostics and emitted sourcemaps stay accurate.
 *
 *   typor build              # plain `tsc`
 *   typor build -b           # build mode
 *   typor build -p tsconfig.json
 */
export class BuildCommand extends TyporCommand {
  readonly summary = 'Run tsc with typor extended syntax understood [tsc args…].';

  run(argv: string[]): number {
    const workspace = WorkspaceRoot.find();
    const packagesDir = path.join(workspace, 'packages');

    const rejected = BuildCommand.rejectPositional(argv);
    if (rejected !== null) return rejected;

    const aliasesByPackage = new Map<string, unknown>();
    const aliasesFor = (file: string): any => {
      const pkg = path.relative(packagesDir, file).split(path.sep)[0];
      if (!aliasesByPackage.has(pkg)) {
        aliasesByPackage.set(pkg, AliasEmitRewrite.aliasesOf(path.join(packagesDir, pkg)));
      }
      return aliasesByPackage.get(pkg);
    };

    const originals = new Map<string, string>();
    try {
      for (const file of SourceWalk.files(packagesDir)) {
        const source = readFileSync(file, 'utf8');
        const aliases = aliasesFor(file);
        const needsAlias = AliasEmitRewrite.handles(source, aliases);
        const needsSyntax = TyporSyntaxPlugin.handles(source);
        if (!needsAlias && !needsSyntax) continue;
        originals.set(file, source);
        let next = needsSyntax ? TyporSyntaxPlugin.transform(source) : source;
        if (needsAlias) next = AliasEmitRewrite.transform(next, file, aliases);
        writeFileSync(file, next, 'utf8');
      }
      // Run the caller's OWN tsc invocation, in the caller's OWN cwd — each package keeps its exact build
      // semantics (`tsc`, `tsc -b`, `tsc -p x`); typor only supplies the transformed source underneath.
      const tsc = path.join(workspace, 'node_modules/.bin/tsc');
      const run = spawnSync(tsc, argv, { encoding: 'utf8', cwd: process.cwd() });
      process.stdout.write((run.stdout || '') + (run.stderr || ''));
      console.log(`[typor] tsc ${argv.join(' ')} (${originals.size} file(s) rewritten: extended syntax / package alias)`);
      return run.status ?? 0;
    } finally {
      // ALWAYS restore, even on crash/interrupt — source must never be left rewritten.
      for (const [file, source] of originals) writeFileSync(file, source, 'utf8');
    }
  }

  /**
   * A POSITIONAL path (`typor build packages/core`) makes tsc treat it as a file list, which silently
   * ignores tsconfig.json — no outDir, so `.js`/`.d.ts` land beside every source. Those duplicate modules
   * then break `Enum` reference identity at runtime (two copies of the same enum). Refuse it outright.
   *
   * In BUILD mode (`-b`) a positional is a project path and tsconfig is still honoured, so it is fine.
   *
   * Returns the exit code to stop with, or `null` to continue.
   */
  private static rejectPositional(argv: string[]): number | null {
    const buildMode = argv.some((a) => a === '-b' || a === '--build');
    for (const arg of buildMode ? [] : argv) {
      if (!arg.startsWith('-') && !/^(tsconfig[\w.-]*\.json)$/.test(arg)) {
        console.error(`[typor] refusing positional argument "${arg}": tsc would ignore tsconfig.json and emit\n` +
          `        build output beside your sources. Pass flags only (e.g. \`-b\`, \`-p tsconfig.json\`).`);
        return 2;
      }
    }
    return null;
  }
}
