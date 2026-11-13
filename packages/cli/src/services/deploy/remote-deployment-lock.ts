import { DeploymentLock } from '@cli/services/deploy/deployment-lock';
import { RemoteShell } from '@cli/services/deploy/remote-shell';

/** The deployment folder's lock, taken from this machine over the target's shell. */
export class RemoteDeploymentLock {
  constructor(private readonly shell: Pick<RemoteShell, 'run'>, private readonly owner: string = DeploymentLock.CLI) {}

  /** '' when the folder is now ours; otherwise who is deploying to it. */
  async acquire(): Promise<string> {
    const held = await this.holder();
    if (held) return held;
    // `set -C` makes the redirect fail when the file exists, so of two deployers arriving together one loses.
    const taken = await this.shell.run(
      `rm -f ${DeploymentLock.FILE}; ( set -C; printf '%s ${this.owner}\\n' "$(date +%s)" > ${DeploymentLock.FILE} ) 2>/dev/null`,
    );
    if (taken.code === 0) return '';
    return (await this.holder()) || 'another deployer';
  }

  async release(): Promise<void> {
    await this.shell.run(`rm -f ${DeploymentLock.FILE}`);
  }

  /** Read with the box's own clock, so a difference between the two machines' clocks ages nothing. */
  private async holder(): Promise<string> {
    const read = await this.shell.run(`date +%s; cat ${DeploymentLock.FILE} 2>/dev/null`);
    const [now, ...content] = read.stdout.split('\n');
    return DeploymentLock.holder(content.join('\n'), Number(now) || 0);
  }
}
