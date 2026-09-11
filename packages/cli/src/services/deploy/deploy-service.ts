import chalk from 'chalk';
import { DeploymentTarget } from '@cli/services/deploy/deployment-target';
import { RemoteShell } from '@cli/services/deploy/remote-shell';
import { ComposeStack } from '@cli/services/deploy/compose-stack';
import { ReleaseHealthProbe } from '@cli/services/deploy/release-health-probe';
import { ImageRetention } from '@cli/services/deploy/image-retention';
import { DeploymentVersionStore } from '@cli/services/deploy/deployment-version-store';

/**
 * Deploy a published release to a target, prove it is serving, and clean up after it.
 *
 * The order matters and each step exists because its absence cost something: pull BEFORE `.env` is
 * touched (an unpublished version must change nothing), require the api to report the version just
 * deployed (a crash-looping image leaves the old container answering), roll back when it does not,
 * and prune only after success (the rollback target has to survive).
 */
export class DeployService {
  constructor(
    private readonly target: DeploymentTarget,
    private readonly shell: RemoteShell,
    private readonly stack: ComposeStack,
    private readonly versions: DeploymentVersionStore,
    private readonly probe: ReleaseHealthProbe,
  ) {}

  static async forTarget(name: string, healthTimeoutMs: number): Promise<DeployService> {
    const target = await DeploymentTarget.load(name);
    const shell = new RemoteShell(target);
    const stack = new ComposeStack(shell);
    return new DeployService(
      target,
      shell,
      stack,
      new DeploymentVersionStore(shell),
      new ReleaseHealthProbe(stack, healthTimeoutMs),
    );
  }

  async deploy(version: string): Promise<boolean> {
    const replaced = await this.versions.current();
    console.log(chalk.blue(`\n${this.target.name}: ${replaced || 'none'} -> ${version}`));

    if (await this.stack.pull(version) !== 0) {
      console.error(chalk.red(`Could not pull ${version} — nothing was changed.`));
      return false;
    }

    await this.versions.set(version);
    await this.stack.up();

    if (!await this.probe.waitFor(version)) {
      await this.rollback(version, replaced);
      return false;
    }

    console.log(chalk.green(`${version} is serving.`));
    await this.versions.rememberReplaced(replaced !== version ? replaced : '');
    await this.prune(version);
    return true;
  }

  private async rollback(failed: string, replaced: string): Promise<void> {
    console.error(chalk.red(`\n${failed} did not report itself healthy.`));
    console.error(await this.stack.apiLogs(40));

    if (!replaced || replaced === failed) {
      console.error(chalk.red('No previous version recorded — leaving the stack as it is.'));
      return;
    }

    console.error(chalk.yellow(`Rolling back to ${replaced}...`));
    await this.versions.set(replaced);
    await this.stack.up();
    const restored = await this.probe.waitFor(replaced);
    console.error(restored
      ? chalk.yellow(`Rolled back; ${replaced} is serving.`)
      : chalk.red(`Rollback to ${replaced} did not come up either — the stack needs a person.`));
  }

  private async prune(version: string): Promise<void> {
    const rollback = await this.versions.rollbackTarget();
    const listed = await this.shell.runOrThrow("docker images --format '{{.Repository}}:{{.Tag}}'");
    const removable = ImageRetention.prunable(listed.split('\n'), ImageRetention.keepSet(version, rollback));

    if (removable.length === 0) {
      console.log(chalk.gray('Nothing to reclaim.'));
      return;
    }

    console.log(chalk.gray(`Keeping ${version}${rollback ? ` and ${rollback}` : ''}; removing ${removable.length} images.`));
    // One call: a round trip per image is minutes of ssh handshakes on a box with thirty of them.
    await this.shell.run(`docker rmi ${removable.join(' ')} > /dev/null 2>&1 || true`);
    const disk = await this.shell.run('df -h / | tail -1');
    console.log(chalk.gray(disk.stdout.trim()));
  }
}
