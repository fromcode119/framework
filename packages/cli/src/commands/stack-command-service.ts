import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import { StackService } from '@cli/services/stack/stack-service';
import { StackStore } from '@cli/services/stack/stack-store';
import { StackPlan } from '@cli/services/stack/stack-plan';

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
  }

  private static registerUp(stack: Command): void {
    stack
      .command('up <name>')
      .description('Start an isolated stack running a worktree (builds no images)')
      .option('-f, --framework <path>', 'Framework worktree to run', process.cwd())
      .option('-p, --plugin <path...>', 'Plugin worktree to mount', [])
      // NOT `--version`: commander already owns that on the program, so the flag printed the CLI's
      // own version and never started a stack.
      .option('-t, --tag <tag>', 'Released image tag to run on')
      .option('--port <port>', 'Port on 127.0.0.1', (value) => parseInt(value, 10))
      .action(async (name: string, options: Record<string, unknown>) => {
        const service = new StackService();
        const framework = path.resolve(String(options.framework));

        try {
          const request = {
            name,
            framework,
            plugins: (options.plugin as string[]).map((plugin) => path.resolve(plugin)),
            version: String(options.tag || StackCommandService.versionOf(framework)),
            port: (options.port as number) || new StackStore().nextPort(),
          };
          await service.up(request);

          console.log(chalk.green(`\nStack "${name}" is up.`));
          for (const url of new StackPlan(request).urls()) {
            console.log(`  ${url}`);
          }
          console.log(chalk.gray(`\n  down: fromcode stack down ${name}`));
        } catch (error) {
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
