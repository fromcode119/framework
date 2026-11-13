import chalk from 'chalk';
import { DeploymentTarget } from '@cli/services/deploy/deployment-target';
import { RemoteShell } from '@cli/services/deploy/remote-shell';
import { ComposeStack } from '@cli/services/deploy/compose-stack';
import { ReleaseHealthProbe } from '@cli/services/deploy/release-health-probe';
import { ImageRetention } from '@cli/services/deploy/image-retention';
import { DeploymentVersionStore } from '@cli/services/deploy/deployment-version-store';
import { DeployStrategy } from '@cli/services/deploy/deploy-strategy';
import { RollingDeploy } from '@cli/services/deploy/rolling-deploy';
import { DeployMode } from '@fromcode119/core';
import { ComposeFilesSync } from '@cli/services/deploy/compose-files-sync';
import { RemoteDeploymentLock } from '@cli/services/deploy/remote-deployment-lock';

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
    private readonly rolling: (stack: ComposeStack) => RollingDeploy = (stack) => new RollingDeploy(stack),
    private readonly composeFiles: Pick<ComposeFilesSync, 'sync'> = new ComposeFilesSync(shell),
    private readonly lock: Pick<RemoteDeploymentLock, 'acquire' | 'release'> = new RemoteDeploymentLock(shell),
  ) {}

  static async forTarget(name: string, healthTimeoutMs: number): Promise<DeployService> {
    return DeployService.using(await DeploymentTarget.load(name), healthTimeoutMs);
  }

  static using(target: DeploymentTarget, healthTimeoutMs: number): DeployService {
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

  /**
   * One deployer at a time. A box whose own updater is switched on would otherwise start the same
   * release in the same minute, and the two undo each other's containers (see `DeploymentLock`).
   */
  async deploy(version: string): Promise<boolean> {
    const heldBy = await this.lock.acquire();
    if (heldBy) {
      console.error(chalk.red(`\n${this.target.name}: ${heldBy} is deploying here right now — nothing was changed. Run this again when it has finished.`));
      return false;
    }
    try {
      return await this.deployLocked(version);
    } finally {
      await this.lock.release();
    }
  }

  private async deployLocked(version: string): Promise<boolean> {
    const replaced = await this.versions.current();
    console.log(chalk.blue(`\n${this.target.name}: ${replaced || 'none'} -> ${version}`));

    // The release's compose files first: a service it adds exists only in them, so the pull needs them.
    await this.composeFiles.sync(version);
    if (await this.stack.pull(version) !== 0) {
      if (replaced) await this.composeFiles.sync(replaced);
      console.error(chalk.red(`Could not pull ${version} — nothing was changed.`));
      return false;
    }

    await this.versions.set(version);
    await this.versions.handUpdatesToThisCli();
    // The operator's deploy mode (Settings → Infrastructure), unless this release or this box rules
    // rolling out — and then it says why, rather than silently taking the sites down.
    const plan = await new DeployStrategy(this.stack).choose();
    console.log(chalk.blue(`Deploy mode: ${plan.mode.value} — ${plan.reason}.`));
    if (plan.mode === DeployMode.ROLLING) {
      if (!await this.rolling(this.stack).run(version)) {
        await this.rollback(version, replaced, DeployMode.ROLLING);
        return false;
      }
    } else {
      await this.stack.up();
    }

    // The mode goes with it: a release that rolled in and then did not answer rolls out the same way.
    if (!await this.probe.waitFor(version)) {
      await this.rollback(version, replaced, plan.mode);
      return false;
    }
    if (plan.mode === DeployMode.ROLLING) await this.removeStrays(version);

    console.log(chalk.green(`${version} is serving.`));
    await this.versions.rememberReplaced(replaced !== version ? replaced : '');
    await this.prune(version);
    return true;
  }

  /**
   * A failed ROLLING deploy is rolled back the same way: the apps it already swapped go back one at a
   * time, so the operator who chose no downtime does not get the outage on the way back either. Only
   * when that fails too is the whole stack recreated.
   */
  private async rollback(failed: string, replaced: string, mode: DeployMode = DeployMode.RESTART): Promise<void> {
    console.error(chalk.red(`\n${failed} did not report itself healthy.`));
    console.error(await this.stack.apiLogs(40));

    if (!replaced || replaced === failed) {
      console.error(chalk.red('No previous version recorded — leaving the stack as it is.'));
      return;
    }

    console.error(chalk.yellow(`Rolling back to ${replaced}...`));
    const edges = await this.stack.containerIds(ComposeStack.EDGE);
    await this.composeFiles.sync(replaced);
    await this.versions.set(replaced);
    // A release from before the edge publishes the ports on its gateway again; an edge left running
    // would hold them, and that gateway could not start.
    if (edges.length && !(await this.stack.declared([ComposeStack.EDGE])).length) {
      console.error(chalk.yellow(`${replaced} has no edge; stopping it so its gateway can take ports 80 and 443 back.`));
      for (const id of edges) await this.stack.stopAndRemove(id, 10);
    }
    const rolledBack = mode === DeployMode.ROLLING && await this.rolling(this.stack).run(replaced);
    if (!rolledBack) await this.stack.up();
    const restored = await this.probe.waitFor(replaced);
    console.error(restored
      ? chalk.yellow(`Rolled back; ${replaced} is serving.`)
      : chalk.red(`Rollback to ${replaced} did not come up either — the stack needs a person.`));
  }

  /**
   * A container of a rolled service still on another version after the release serves is nobody's: it
   * shares the service's name on the network, so it answers a share of the requests with the old code
   * and runs every scheduled task a second time. One was left for an hour by a deployer that raced this one.
   */
  private async removeStrays(version: string): Promise<void> {
    for (const stray of await this.stack.strays([...DeployStrategy.ROLLED, 'gateway', ...ComposeStack.EXTENSION_HOSTS], version)) {
      console.error(chalk.yellow(`${stray.name} still runs ${stray.image} beside ${version}; removing it.`));
      await this.stack.stopAndRemove(stray.id, RollingDeploy.STOP_GRACE_SECONDS);
    }
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
