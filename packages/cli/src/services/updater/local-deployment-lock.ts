import fs from 'fs';
import path from 'path';
import { DeploymentLock } from '@cli/services/deploy/deployment-lock';

/** The deployment folder's lock, taken by a process that has the folder on its own filesystem. */
export class LocalDeploymentLock {
  private readonly file: string;

  constructor(
    directory: string,
    private readonly owner: string = DeploymentLock.UPDATER,
    private readonly nowSeconds: () => number = () => Math.floor(Date.now() / 1000),
  ) {
    this.file = path.join(directory, DeploymentLock.FILE);
  }

  /** '' when the folder is now ours; otherwise who is deploying to it. */
  acquire(): string {
    const held = this.holder();
    if (held) return held;
    fs.rmSync(this.file, { force: true });
    try {
      // 'wx' fails when the file exists, so of two deployers arriving together one loses.
      fs.writeFileSync(this.file, `${DeploymentLock.line(this.owner, this.nowSeconds())}\n`, { flag: 'wx' });
      return '';
    } catch {
      return this.holder() || 'another deployer';
    }
  }

  release(): void {
    fs.rmSync(this.file, { force: true });
  }

  private holder(): string {
    let content = '';
    try { content = fs.readFileSync(this.file, 'utf8'); } catch { return ''; }
    return DeploymentLock.holder(content, this.nowSeconds());
  }
}
