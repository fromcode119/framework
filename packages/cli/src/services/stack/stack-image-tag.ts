import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { StackLayout } from '@cli/services/stack/stack-layout';
import type { IStackImageChoice } from '@cli/services/stack/interfaces/stack-image-choice.interface';

/**
 * Which released image tag a stack runs on, chosen among the ones already on this machine.
 *
 * The worktree's own version is preferred, because its image's node_modules matches the code
 * mounted over it. But a worktree is usually AHEAD of every image here: on 2026-11-19 a stack
 * asked for v0.2.606, compose started pulling four 3 GB images, and the pull then failed because
 * that tag had no arm64 build. A missing tag is therefore never pulled implicitly — the stack
 * falls back to the template's tag, then to the newest one present, and says so.
 *
 * The image names come from the framework's own images file, so nothing here names a registry.
 */
export class StackImageTag {
  /** A tag written as `${VERSION:-latest}` after an image name in the images file. */
  private static readonly IMAGE_LINE = /image:\s*(?:\$\{\w+:-)?([^\s:${}]+):\$\{VERSION/g;

  private constructor(
    private readonly images: string[],
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
    return [...first]
      .filter((tag) => rest.every((tags) => tags.has(tag)) && /^v?\d+\.\d+\.\d+$/.test(tag))
      .sort(StackImageTag.newestFirst);
  }

  /**
   * The tag to run on, and why when it is not the preferred one.
   *
   * An explicit tag is taken as given: the caller asked for it, pull included.
   */
  choose(explicit: string | undefined, preferred: string, template: string | null): IStackImageChoice {
    if (explicit) return { tag: explicit, note: null };

    const available = this.available();
    if (available.includes(preferred)) return { tag: preferred, note: null };
    if (!available.length) {
      throw new Error(
        `No released image of this topology is on this machine (wanted ${preferred}).\n` +
          `  Pull one on purpose, then pass it:  --tag <tag>`,
      );
    }

    const tag = template && available.includes(template) ? template : available[0];
    const why = template === tag ? 'the template was captured on it' : 'it is the newest one here';
    return {
      tag,
      note: `${preferred} is not on this machine, so the stack runs on ${tag} (${why}); nothing is pulled.`,
    };
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

  private static newestFirst(a: string, b: string): number {
    const parts = (tag: string) => tag.replace(/^v/, '').split('.').map(Number);
    const [x, y] = [parts(a), parts(b)];
    for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return y[i] - x[i];
    return 0;
  }
}
