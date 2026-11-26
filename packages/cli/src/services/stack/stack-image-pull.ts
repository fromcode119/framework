import { spawnSync } from 'child_process';
import chalk from 'chalk';
import type { StackImageTag } from '@cli/services/stack/stack-image-tag';
import type { StackReleaseCatalog } from '@cli/services/stack/stack-release-catalog';

/** Brings the images of one tag onto this machine, before compose would try to. */
export class StackImagePull {
  constructor(
    private readonly images: StackImageTag,
    private readonly releases: StackReleaseCatalog,
    private readonly docker: (args: string[]) => number = StackImagePull.streamed,
  ) {}

  /** Pulls what is missing of `tag`; true when it pulled anything. */
  async ensure(tag: string): Promise<boolean> {
    const lacking = this.images.lacking(tag);
    for (const image of lacking) {
      const reference = `${image}:${tag}`;
      const platform = StackImagePull.platformFor(await this.releases.platforms(reference), process.arch);
      console.log(chalk.blue(`  Pulling ${reference}${platform ? ` (${platform})` : ''}`));

      if (this.docker(['pull', '--quiet', ...(platform ? ['--platform', platform] : []), reference]) !== 0) {
        throw new Error(`Could not pull ${reference}. Check the connection, \`docker login\` and the free disk space.`);
      }
    }
    return lacking.length > 0;
  }

  /**
   * The platform to name when pulling, or null when docker's own choice works.
   *
   * Releases are built for amd64 only, and on an arm64 machine a plain pull refuses them with "no
   * matching manifest"; naming the platform pulls the image, which then runs emulated.
   */
  static platformFor(published: readonly string[] | null, arch: string): string | null {
    if (!published?.length) return null;

    const own = `linux/${arch === 'x64' ? 'amd64' : arch}`;
    return published.includes(own) ? null : published[0];
  }

  private static streamed(args: string[]): number {
    return spawnSync('docker', args, { stdio: ['ignore', 'inherit', 'inherit'] }).status ?? 1;
  }
}
