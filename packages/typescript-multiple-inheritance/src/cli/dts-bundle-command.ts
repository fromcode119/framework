import { existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { DeclarationBundle } from '../declaration-bundle';
import { BuildCommand } from './build-command';
import { TyporCommand } from './tsmi-command';

/**
 * `typescript-multiple-inheritance dts-bundle -p <declaration-project> --dist <dir>` — emit a facade
 * package's forwarded declarations into its own `dist`, then repoint every specifier at them.
 *
 * Two steps, because `tsc` does the first and nothing does the second:
 *   1. `build -p <project>` emits real `.d.ts` for the forwarded entries (through the same extended-syntax
 *      rewrite every other build uses, so sources that `tsc` cannot parse still emit);
 *   2. `DeclarationBundle` rewrites the alias/package specifiers that survived into relative paths.
 *
 * The output directory and the root are READ FROM the project, never passed again here — a second
 * spelling of either is a second thing to keep true.
 */
export class DtsBundleCommand extends TyporCommand {
  readonly summary = 'Emit a facade package’s forwarded declarations into its dist and make them self-contained.';

  run(argv: string[]): number {
    const project = DtsBundleCommand.flag(argv, '-p') ?? DtsBundleCommand.flag(argv, '--project');
    const dist = DtsBundleCommand.flag(argv, '--dist');
    if (!project || !dist) {
      console.error('[typescript-multiple-inheritance] usage: dts-bundle -p <declaration-project> --dist <dir>');
      return 2;
    }

    const projectPath = path.resolve(process.cwd(), project);
    const distDir = path.resolve(process.cwd(), dist);
    if (!existsSync(projectPath)) {
      console.error(`[typescript-multiple-inheritance] declaration project not found: ${projectPath}`);
      return 2;
    }

    const options = DtsBundleCommand.optionsOf(projectPath);
    if (!options.outDir || !options.rootDir) {
      console.error(`[typescript-multiple-inheritance] ${project} must set both "outDir" and "rootDir".`);
      return 2;
    }

    const built = new BuildCommand().run(['-p', projectPath]);
    if (built !== 0) return built;

    const changed = DeclarationBundle.apply(projectPath, distDir, options.outDir, options.rootDir);
    console.log(`[typescript-multiple-inheritance] dts-bundle: ${changed} declaration file(s) repointed at ${path.relative(process.cwd(), options.outDir)}.`);
    return 0;
  }

  /** The project's resolved `outDir`/`rootDir`, absolute. */
  private static optionsOf(project: string): { outDir?: string; rootDir?: string } {
    const parsed = ts.getParsedCommandLineOfConfigFile(project, {}, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => undefined,
    } as ts.ParseConfigFileHost);
    return { outDir: parsed?.options?.outDir, rootDir: parsed?.options?.rootDir };
  }

  /** The value that follows `name` in argv, or null. */
  private static flag(argv: string[], name: string): string | null {
    const at = argv.indexOf(name);
    return at >= 0 && at + 1 < argv.length ? argv[at + 1] : null;
  }
}
