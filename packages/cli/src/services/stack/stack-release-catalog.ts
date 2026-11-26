import { StackCommand } from '@cli/services/stack/stack-command';
import { StackReleaseOrder } from '@cli/services/stack/stack-release-order';
import type { IStackReleases } from '@cli/services/stack/interfaces/stack-releases.interface';

/**
 * The releases there are to run: the repository's own tags, checked against the registry.
 *
 * A tag alone is not a release a stack can run. Its images are published by a job that finishes
 * minutes after the tag exists, so each candidate is asked of the registry for every image.
 */
export class StackReleaseCatalog implements IStackReleases {
  /** How many of the newest tags are tried before giving up. */
  private static readonly CANDIDATES = 5;

  constructor(
    private readonly repository: string,
    private readonly run: typeof StackCommand.output = StackCommand.output,
  ) {}

  async latest(images: readonly string[], local: readonly string[]): Promise<string | null> {
    const listed = await this.run('git', ['-C', this.repository, 'ls-remote', '--tags', '--refs', 'origin', 'v*']);
    const tags = StackReleaseOrder.releases((listed ?? '').split('\n').map((line) => line.trim().split('refs/tags/')[1] ?? ''));

    for (const tag of tags.slice(0, StackReleaseCatalog.CANDIDATES)) {
      if (local.includes(tag) || (await this.isPublished(images, tag))) return tag;
    }
    return null;
  }

  async isPublished(images: readonly string[], tag: string): Promise<boolean> {
    if (!images.length) return false;

    const found = await Promise.all(images.map((image) => this.platforms(`${image}:${tag}`)));
    return found.every((platforms) => platforms !== null);
  }

  /**
   * The platforms a published image is built for, empty when the registry does not list them, and
   * null when there is no such image.
   */
  async platforms(reference: string): Promise<string[] | null> {
    const answer = await this.run('docker', ['manifest', 'inspect', reference]);
    if (answer === null) return null;

    const document = JSON.parse(answer) as { manifests?: { platform?: { os?: string; architecture?: string } }[] };
    return (document.manifests ?? [])
      .map((manifest) => manifest.platform)
      .filter((platform) => platform?.os && platform.os !== 'unknown')
      .map((platform) => `${platform!.os}/${platform!.architecture}`);
  }
}
