import { Command } from 'commander';
// TYPE-only: erased at compile time, so it does not reintroduce the eager load fixed below.
import type { ExtensionKind } from '@fromcode119/extension-builder';
import chalk from 'chalk';
import * as path from 'path';
import { CliUtils } from '@cli/utils';

/**
 * `fromcode build|pack|checksum <kind> <slug>` — the replacement for `./build-plugins.sh`.
 *
 * Thin by design: argument parsing, resolving where the extension lives, and an exit code. Every
 * decision about HOW to build belongs to ExtensionBuildPipeline, so the CLI, the api and the admin
 * cannot drift apart the way the three previous builders did.
 *
 * The builder is imported LAZILY, inside each action. A top-level import pulled its whole graph
 * into every CLI invocation — including commands that build nothing — and that graph reaches React
 * components whose decorators tsx cannot compile, so an unrelated command died with "Cannot read
 * properties of undefined (reading 'value')". A command must not cost anything until it runs.
 */
export class ExtensionBuildCommandService {
  static register(program: Command): void {
    ExtensionBuildCommandService.registerBuild(program);
    ExtensionBuildCommandService.registerPack(program);
    ExtensionBuildCommandService.registerChecksum(program);
  }

  /**
   * Where the extension's source is.
   *
   * `plugins/<slug>`, `themes/<slug>` or `appearance/<slug>` under the workspace root, unless the
   * caller names a directory outright. An explicit `--dir` is how the framework's OWN extensions are
   * built: they live inside the framework (`extensions/<slug>`), not in the operator's plugins mount,
   * and deriving that layout here would bake one arrangement into a resolver whose whole point is
   * that the monorepo is one arrangement and not the arrangement.
   */
  private static resolveDir(directoryName: string, slug: string, explicitDir?: string): string {
    if (explicitDir) return path.resolve(explicitDir);
    return path.resolve(path.dirname(CliUtils.getPluginsDir()), directoryName, slug);
  }

  private static reportAndExit(steps: Array<{ step: string; failed: boolean; skippedReason?: string; message?: string }>): void {
    for (const step of steps) {
      // The MESSAGE is the point of a failure: "✗ archive-writer" alone sends the reader to read
      // the builder's source to find out what went wrong, which is what the old bash did.
      if (step.failed) console.log(chalk.red(`  ✗ ${step.step}${step.message ? `: ${step.message}` : ''}`));
      // A skipped step is PRINTED with its reason. Not printing it is exactly how a build that
      // silently did nothing could exit 0 for a week.
      else if (step.skippedReason) console.log(chalk.gray(`  – ${step.step}: ${step.skippedReason}`));
      else console.log(chalk.green(`  ✓ ${step.step}`));
    }
    if (steps.some((s) => s.failed)) process.exitCode = 1;
  }

  private static async run(kindValue: string, slug: string, pack: boolean, explicitDir?: string): Promise<void> {
    const { ExtensionBuildPipeline, ExtensionKind } = await import('@fromcode119/extension-builder');

    let kind: ExtensionKind;
    try {
      kind = ExtensionKind.require(kindValue);
    } catch (error) {
      console.error(chalk.red(String(error)));
      process.exitCode = 1;
      return;
    }

    const sourceDir = ExtensionBuildCommandService.resolveDir(kind.directoryName(), slug, explicitDir);
    console.log(chalk.blue(`${pack ? 'Packing' : 'Building'} ${kind.value} ${slug}`));
    console.log(chalk.gray(`  ${sourceDir}`));

    const steps = await ExtensionBuildPipeline.run({ sourceDir, kind, slug, pack });
    ExtensionBuildCommandService.reportAndExit(steps.map((s) => ({ step: s.step, failed: s.failed, skippedReason: s.skippedReason, message: s.message })));
  }

  private static registerBuild(program: Command): void {
    program
      .command('build <kind> <slug>')
      .description('Build a plugin, theme or appearance in place (kind: plugin|theme|appearance)')
      .option('--dir <path>', "The extension's source directory, when it is not under the workspace root")
      .action(async (kind: string, slug: string, options: { dir?: string }) =>
        ExtensionBuildCommandService.run(kind, slug, false, options.dir));
  }

  private static registerPack(program: Command): void {
    program
      .command('pack <kind> <slug>')
      .description('Build, clean and re-stamp an extension for distribution')
      .option('--dir <path>', "The extension's source directory, when it is not under the workspace root")
      .action(async (kind: string, slug: string, options: { dir?: string }) =>
        ExtensionBuildCommandService.run(kind, slug, true, options.dir));
  }

  private static registerChecksum(program: Command): void {
    program
      .command('checksum <kind> <slug>')
      .description('Re-stamp an extension integrity checksum after an in-place rebuild')
      .option('--dir <path>', "The extension's source directory, when it is not under the workspace root")
      .action(async (kindValue: string, slug: string, options: { dir?: string }) => {
        const { ExtensionKind, IntegrityStamper } = await import('@fromcode119/extension-builder');

        let kind: ExtensionKind;
        try {
          kind = ExtensionKind.require(kindValue);
        } catch (error) {
          console.error(chalk.red(String(error)));
          process.exitCode = 1;
          return;
        }
        const sum = await IntegrityStamper.stampSourceDir(
          ExtensionBuildCommandService.resolveDir(kind.directoryName(), slug, options.dir));
        console.log(sum ? chalk.green(`Checksum ${slug}: ${sum}`) : chalk.yellow(`${slug} has no manifest.json to stamp`));
      });
  }
}
