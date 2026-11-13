/**
 * The mark one deployer leaves in the deployment folder while it changes the stack.
 *
 * A box can have two things able to deploy to it: this CLI, over ssh, and the platform's own updater
 * service, inside the stack. Each used to start without looking for the other. Run in the same minute
 * they both rolled the api, each failed on the containers the other had just made, each rolled back —
 * and one of the rollbacks recreated the whole stack while visitors were on it. So whoever starts first
 * writes this file, and the other waits or refuses until it is gone.
 *
 * A deployer that died leaves its mark behind; one older than `STALE_SECONDS` is nobody's.
 */
export class DeploymentLock {
  static readonly FILE = '.deploy-in-progress';
  /** Longer than any deploy takes, rollback included; after it the mark is treated as abandoned. */
  static readonly STALE_SECONDS = 30 * 60;
  static readonly CLI = 'the deploy command';
  static readonly UPDATER = 'the updater of this deployment';

  /** What is written: who, and when (seconds since the epoch, by the box's own clock). */
  static line(owner: string, nowSeconds: number): string {
    return `${nowSeconds} ${owner}`;
  }

  /** Who holds the folder according to `content`, or '' when nobody does (no mark, an unreadable or an abandoned one). */
  static holder(content: string, nowSeconds: number): string {
    const match = /^(\d+) (.+)$/.exec(String(content ?? '').trim());
    if (!match) return '';
    const age = nowSeconds - Number(match[1]);
    if (age > DeploymentLock.STALE_SECONDS) return '';
    return match[2].trim();
  }
}
