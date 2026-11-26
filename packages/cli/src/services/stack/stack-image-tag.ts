import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { StackLayout } from '@cli/services/stack/stack-layout';
import { StackReleaseOrder } from '@cli/services/stack/stack-release-order';
import type { IStackImageChoice } from '@cli/services/stack/interfaces/stack-image-choice.interface';
import type { IStackImageQuery } from '@cli/services/stack/interfaces/stack-image-query.interface';

/**
 * Which released image tag a stack runs on.
 *
 * The worktree's own version is preferred, because its image's node_modules matches the code mounted
 * over it; a stack with no framework change runs the latest release. Either is pulled when it is not
 * on this machine. Until 2026-11-26 nothing was ever pulled, so stacks started on whatever was newest
 * HERE: images at v0.2.588 under a main of v0.2.651, where a plugin needing a newer core could not run
 * at all. Only a published tag is pulled — a release takes some minutes to publish its images, and a
 * half-published one is passed over for the release before it. Without the registry (offline, or
 * `--no-pull`) the stack falls back to what is here and says so.
 *
 * The image names come from the framework's own images file, so nothing here names a registry.
 */
export class StackImageTag {
  /** A tag written as `${VERSION:-latest}` after an image name in the images file. */
  private static readonly IMAGE_LINE = /image:\s*(?:\$\{\w+:-)?([^\s:${}]+):\$\{VERSION/g;

  private constructor(
    readonly images: readonly string[],
    private readonly present: (image: string) => string[],
  ) {}

  static of(framework: string): StackImageTag {
    const file = path.join(framework, StackLayout.DEPLOY_DIR, 'docker-compose.images.yml');
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const images = [...new Set([...text.matchAll(StackImageTag.IMAGE_LINE)].map((match) => match[1]))];
    return new StackImageTag(images, StackImageTag.localTagsOf);
  }

  /** For tests: the same choice over a given set of images and the tags each has locally. */
  static over(images: string[], present: (image: string) => string[]): StackImageTag {
    return new StackImageTag(images, present);
  }

  /** The tags every image of the topology has on this machine, newest first. */
  available(): string[] {
    if (!this.images.length) return [];

    const [first, ...rest] = this.images.map((image) => new Set(this.present(image)));
    return StackReleaseOrder.releases([...first].filter((tag) => rest.every((tags) => tags.has(tag))));
  }

  /** The images that do not have `tag` on this machine. */
  lacking(tag: string): string[] {
    return this.images.filter((image) => !this.present(image).includes(tag));
  }

  /**
   * The tag to run on, and why when it is not simply the preferred one.
   *
   * An explicit tag is taken as given: the caller asked for it.
   */
  async choose(query: IStackImageQuery): Promise<IStackImageChoice> {
    const { explicit, preferred, template, releases } = query;
    if (explicit) return { tag: explicit, note: null };

    const available = this.available();
    if (preferred && available.includes(preferred)) return { tag: preferred, note: null };

    if (releases) {
      if (preferred && (await releases.isPublished(this.images, preferred))) return { tag: preferred, note: null };

      const latest = await releases.latest(this.images, available);
      if (latest) {
        const note = preferred
          ? `${preferred} has no published images, so the stack runs on the latest release, ${latest}.`
          : `Running the latest release, ${latest}.`;
        return { tag: latest, note };
      }
    }

    return this.localFallback(available, preferred, template, releases ? 'no release could be read from the registry' : '--no-pull was given');
  }

  private localFallback(available: string[], preferred: string | null, template: string | null, because: string): IStackImageChoice {
    if (!available.length) {
      throw new Error(
        `No released image of this topology is on this machine, and ${because}.\n` +
          '  Check the connection and `docker login`, or pass a published one:  --tag <tag>',
      );
    }

    const tag = template && available.includes(template) ? template : available[0];
    const why = template === tag ? 'the template was captured on it' : 'it is the newest one here';
    const wanted = preferred ?? 'The latest release';
    return { tag, note: `${wanted} is not used (${because}), so the stack runs on ${tag} (${why}).` };
  }

  private static localTagsOf(image: string): string[] {
    try {
      return execFileSync('docker', ['images', image, '--format', '{{.Tag}}'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split('\n')
        .map((tag) => tag.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}
