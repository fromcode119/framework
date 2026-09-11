import fs from 'fs-extra';
import path from 'path';

/**
 * A host this platform is deployed to.
 *
 * Named on the command line, or in `deploy/targets.json` for hosts you deploy to often. That file is
 * NOT committed and neither is any host: an ssh address and a path on someone's server are local
 * configuration, and a framework other people deploy has no business shipping one operator's
 * infrastructure. `targets.example.json` carries the shape; `--host` and `--dir` need no file.
 */
export class DeploymentTarget {
  constructor(
    readonly name: string,
    readonly host: string,
    readonly directory: string,
  ) {}

  static from(name: string, row: Record<string, unknown>): DeploymentTarget {
    const host = String(row.host || '').trim();
    const directory = String(row.directory || '').trim();
    if (!host) throw new Error(`Target "${name}" declares no host`);
    if (!directory) throw new Error(`Target "${name}" declares no directory`);
    return new DeploymentTarget(name, host, directory);
  }

  /** `local` means this machine: no ssh, commands run where the CLI runs. */
  get isLocal(): boolean {
    return this.host === 'local';
  }

  /** The one file that unambiguously marks the deploy directory, wherever the repo is checked out. */
  private static readonly LANDMARK = path.join('deploy', 'docker-compose.full-stack.yml');

  /**
   * Found by its own landmark rather than assumed from a project root.
   *
   * The targets belong beside the compose files they deploy — the CLI runs from the monorepo root,
   * the compose files live under the framework package, and hardcoding that relationship would bake
   * one checkout's layout into the tool.
   */
  static configPath(from: string = process.cwd()): string {
    let directory = path.resolve(from);
    while (true) {
      if (fs.existsSync(path.join(directory, DeploymentTarget.LANDMARK))) {
        return path.join(directory, 'deploy', 'targets.json');
      }
      const parent = path.dirname(directory);
      if (parent === directory) throw new Error('No deploy directory found above the working directory');
      directory = parent;
    }
  }

  /** A host given on the command line — no file, nothing stored, nothing committed. */
  static fromOptions(host: string, directory: string): DeploymentTarget {
    return DeploymentTarget.from('command line', { host, directory });
  }

  static async load(name: string): Promise<DeploymentTarget> {
    const file = DeploymentTarget.configPath();
    if (!await fs.pathExists(file)) {
      throw new Error(
        `No deploy targets declared. Either pass --host and --dir, or copy ${path.basename(file).replace('.json', '.example.json')} to ${file} (it is deliberately not committed).`,
      );
    }
    const targets = await fs.readJson(file);
    const row = targets?.[name];
    if (!row) {
      const known = Object.keys(targets || {}).join(', ') || 'none';
      throw new Error(`Unknown target "${name}". Declared targets: ${known}`);
    }
    return DeploymentTarget.from(name, row);
  }
}
