import { Command } from 'commander';
import chalk from 'chalk';
import { DeployService } from '@cli/services/deploy/deploy-service';

/**
 * `fromcode deploy <version>` — the whole deployment, from the repository rather than from a script
 * that lives on the server and drifts from it.
 */
export class DeployCommandService {
  private static readonly DEFAULT_HEALTH_TIMEOUT_SECONDS = 120;

  static register(program: Command): void {
    program
      .command('deploy <version>')
      .description('Deploy a published release to a target, verify it, and reclaim old images')
      .option('-t, --target <name>', 'target declared in deploy/targets.json', 'staging')
      .option('--health-timeout <seconds>', 'how long to wait for the api to report the new version')
      .action(async (version: string, options: Record<string, string>) => {
        const seconds = Number(options.healthTimeout || DeployCommandService.DEFAULT_HEALTH_TIMEOUT_SECONDS);
        try {
          const service = await DeployService.forTarget(String(options.target), seconds * 1000);
          const deployed = await service.deploy(version);
          if (!deployed) process.exit(1);
        } catch (error: any) {
          console.error(chalk.red(`\n${error.message}`));
          process.exit(1);
        }
      });
  }
}
