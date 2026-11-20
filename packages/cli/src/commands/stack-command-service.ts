import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import { StackService } from '@cli/services/stack/stack-service';
import { StackStore } from '@cli/services/stack/stack-store';
import { StackPlan } from '@cli/services/stack/stack-plan';
import { StackImageTag } from '@cli/services/stack/stack-image-tag';
import { StackTemplate } from '@cli/services/stack/stack-template';
import { StackPluginBuild } from '@cli/services/stack/stack-plugin-build';

/**
 * `fromcode stack` — a throwaway platform for one worktree.
 *
 * Up, look, down. It exists because the alternative was editing a shared compose file with another
 * session's absolute paths in it, and because stacks that nothing tears down accumulate: forty
 * containers from dead sessions and 29 GB of their images were cleared off this machine on
 * 2026-11-18, and the daemon took 188 seconds to start under the weight.
 */
export class StackCommandService {
  static register(program: Command): void {
    const stack = program.command('stack').description('Throwaway local stacks, one per worktree');

    StackCommandService.registerUp(stack);
    StackCommandService.registerDown(stack);
    StackCommandService.registerList(stack);
    StackCommandService.registerPrune(stack);
    StackCommandService.registerSnapshot(stack);
  }

  private static registerUp(stack: Command): void {
    stack
      .command('up <name>')
      .description('Start an isolated stack running a worktree (builds no images)')
      .option('-f, --framework <path>', 'Framework worktree to run', process.cwd())
      .option('-p, --plugin <path...>', 'Plugin worktree to mount (built in place before the stack starts)', [])
      // NOT `--version`: commander already owns that on the program, so the flag printed the CLI's
      // own version and never started a stack.
      .option('-t, --tag <tag>', 'Released image tag to run on (default: the worktree version if it is here, else the template\'s, else the newest here)')
      .option('--port <port>', 'Port on 127.0.0.1', (value) => parseInt(value, 10))
      .option('--from <template>', 'Start from a captured template instead of the setup wizard')
      .action(async (name: string, options: Record<string, unknown>) => {
        const service = new StackService();
        const framework = path.resolve(String(options.framework));
        let request: { name: string; framework: string; plugins: string[]; version: string; port: number } | null = null;

        try {
          request = {
            name,
            framework,
            plugins: (options.plugin as string[]).map((plugin) => path.resolve(plugin)),
            version: StackCommandService.tagFor(framework, options),
            port: new StackStore().claimPort(name, options.port as number | undefined),
          };
          const plan = new StackPlan(request);
          StackCommandService.reportDependencies(plan);
          await StackPluginBuild.all(plan.changedPlugins());
          await service.up(request, options.from ? String(options.from) : undefined);

          console.log(chalk.green(`\nStack "${name}" is up.`));
          for (const url of new StackPlan(request).urls()) {
            console.log(`  ${url}`);
          }
          console.log(chalk.gray(`\n  down: fromcode stack down ${name}`));
        } catch (error) {
          // The port was claimed before any of this; a failed start must not keep it.
          if (request) await service.abandon(name, request.port);
          StackCommandService.fail(error);
        }
      });
  }

  private static registerDown(stack: Command): void {
    stack
      .command('down <name>')
      .description('Stop a stack and remove its containers, volumes and files')
      .action(async (name: string) => {
        try {
          await new StackService().down(name);
          console.log(chalk.green(`Stack "${name}" is gone.`));
        } catch (error) {
          StackCommandService.fail(error);
        }
      });
  }

  private static registerList(stack: Command): void {
    stack
      .command('ls')
      .description('Every local stack, and whether the session that made it is still alive')
      .action(() => {
        const stacks = new StackService().list();
        if (!stacks.length) {
          console.log('No local stacks.');
          return;
        }

        console.log('');
        for (const record of stacks) console.log(StackService.describe(record));
        console.log('');
      });
  }

  private static registerPrune(stack: Command): void {
    stack
      .command('prune')
      .description('Remove stacks whose session has been quiet for a day')
      .option('-y, --yes', 'Do not ask', false)
      .action(async (options: Record<string, unknown>) => {
        const service = new StackService();
        const stale = service.stale();

        if (!stale.length) {
          console.log('Nothing to prune.');
          return;
        }

        console.log(chalk.yellow('\nThese stacks look abandoned:\n'));
        for (const record of stale) console.log(StackService.describe(record));

        if (!options.yes) {
          console.log(chalk.gray('\nThis deletes their databases. Re-run with --yes to do it.\n'));
          return;
        }

        for (const record of stale) {
          await service.down(record.name);
          console.log(chalk.green(`  removed ${record.name}`));
        }
      });
  }

  /**
   * Says up front what a mounted plugin still needs.
   *
   * Said before the stack starts, because the alternative is finding it in the api's log after the
   * command has already reported success — the plugin is installed but never registered, so the
   * console simply does not show it and nothing on screen says why.
   */
  /** The image tag, never one that would make compose pull gigabytes the caller did not ask for. */
  private static tagFor(framework: string, options: Record<string, unknown>): string {
    const template = options.from ? StackTemplate.versionAt(new StackStore().root, String(options.from)) : null;
    const choice = StackImageTag.of(framework).choose(
      options.tag ? String(options.tag) : undefined,
      StackCommandService.versionOf(framework),
      template,
    );
    if (choice.note) console.log(chalk.yellow(`\n${choice.note}`));
    return choice.tag;
  }

  private static reportDependencies(plan: StackPlan): void {
    for (const plugin of plan.mirroredPlugins()) {
      console.log(chalk.yellow(`\n${plugin} is the shared mirror of main, so it is mounted READ-ONLY.`));
      console.log(chalk.gray('  It is not a change. To test one, cut a worktree of it and pass that with --plugin.'));
    }

    const missing = plan.missingDependencies();
    if (!missing.size) return;

    console.log(chalk.yellow('\nThese are declared but not mounted:'));
    for (const [slug, needs] of missing) console.log(`  ${slug} needs ${needs.join(', ')}`);
    console.log(chalk.gray('  Each must already be installed in the template, or be mounted with --plugin,'));
    console.log(chalk.gray('  or the plugin is installed and never registered.\n'));
  }

  /**
   * Captures a stack that has been through setup once, so later stacks skip it.
   *
   * There is no headless way to create a site or an admin account — the CLI has no command for
   * either — so a fresh stack always meant a trip through the first-run wizard. This is the escape:
   * do it once, capture it, and start from it afterwards.
   */
  private static registerSnapshot(stack: Command): void {
    stack
      .command('snapshot <name>')
      .description('Capture a stack as a template for later stacks')
      .option('--as <template>', 'Name for the template', 'default')
      .action(async (name: string, options: Record<string, unknown>) => {
        try {
          console.log(chalk.gray(`Stopping "${name}" so the database is copied cleanly…`));
          const root = await new StackService().snapshot(name, String(options.as));

          console.log(chalk.green(`\nTemplate "${String(options.as)}" captured from "${name}".`));
          console.log(chalk.gray(`  ${root}`));
          console.log(chalk.gray(`  use it: fromcode stack up <new> --from ${String(options.as)}`));
        } catch (error) {
          StackCommandService.fail(error);
        }
      });
  }

  /**
   * The image tag to run on.
   *
   * The worktree's own version, because that is the image whose node_modules matches the code being
   * mounted over it. A mismatch is not theoretical — a theme packed against one tag and served by
   * another made every sdk component undefined and crashed the editor with React #130.
   */
  private static versionOf(framework: string): string {
    const file = path.join(framework, 'package.json');
    if (!fs.existsSync(file)) throw new Error(`${framework} has no package.json`);

    const version = String((JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: string }).version || '').trim();
    if (!version) throw new Error(`${file} declares no version`);
    return version.startsWith('v') ? version : `v${version}`;
  }

  private static fail(error: unknown): never {
    console.error(chalk.red(`\n${error instanceof Error ? error.message : String(error)}\n`));
    process.exit(1);
  }
}
