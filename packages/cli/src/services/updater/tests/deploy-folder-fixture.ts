import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * The repository's own `deploy/` folder as a release ships it, and a deployment folder on an OLDER
 * compose file: the one that kept json-file logs and a 256M gateway — what think-in-pink.com ran.
 */
export class DeployFolderFixture {
  static readonly REPO_DEPLOY = path.resolve(__dirname, '../../../../../../deploy');

  /** Every file under the repository's `deploy/`, by path inside it. */
  static release(): Map<string, Buffer> {
    const files = new Map<string, Buffer>();
    const walk = (directory: string, prefix: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(path.join(directory, entry.name), relative);
        else if (entry.isFile()) files.set(relative, fs.readFileSync(path.join(directory, entry.name)));
      }
    };
    walk(DeployFolderFixture.REPO_DEPLOY, '');
    return files;
  }

  /** The release's full-stack file as it was before journald logging and the 512M gateway. */
  static olderFullStack(): string {
    const current = fs.readFileSync(path.join(DeployFolderFixture.REPO_DEPLOY, 'docker-compose.full-stack.yml'), 'utf8');
    return current.replace('driver: journald', 'driver: json-file').replace(/(\n  gateway:[\s\S]*?memory: )512M/, '$1256M');
  }

  /** A deployment folder with the older compose files and an `.env` naming `version` (none when empty). */
  static older(version: string): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-folder-'));
    fs.writeFileSync(path.join(directory, 'docker-compose.full-stack.yml'), DeployFolderFixture.olderFullStack());
    fs.copyFileSync(path.join(DeployFolderFixture.REPO_DEPLOY, 'docker-compose.images.yml'), path.join(directory, 'docker-compose.images.yml'));
    fs.writeFileSync(path.join(directory, '.env'), `JWT_SECRET=kept\n${version ? `VERSION=${version}\n` : ''}`);
    return directory;
  }
}
