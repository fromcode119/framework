import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { StackExtensionWalk } from '@cli/services/stack/stack-extension-walk';

/**
 * The extensions a stack runs, and where each one comes from.
 *
 * A plugin whose dependency is absent is staged, installed and then never registered: the stack
 * comes up looking fine, the plugin is not there, and the reason sits in the api's log. Working on
 * `logistics-boxnow` means `logistics`, which means `finance` — a chain nobody wants to type.
 *
 * The dependencies are taken LIVE from the checkouts beside the framework, which are the mirror of
 * main, and never frozen into a template. A snapshot of "the base plugins" would be stale within
 * the week, and could not work anyway: a template captures the platform's data directory, not the
 * extension code, so it would restore rows describing plugins whose files are not there.
 *
 * They are mounted READ-ONLY. They are not what is being changed, and a container must not be able
 * to write into the shared checkouts — a dirty mirror is somebody's lost work.
 */
export class StackExtensions {
  /** What a resolved extension needs for its mount. */
  private constructor(
    readonly mirror: string | null,
    private readonly kind: string,
  ) {}

  static of(framework: string, kind: string): StackExtensions {
    return new StackExtensions(StackExtensions.mirrorOf(framework), kind);
  }

  /**
   * The directory the extension checkouts sit in, found through git rather than assumed.
   *
   * A worktree lives in a scratchpad, nowhere near them, but it knows where its own repository is:
   * `--git-common-dir` points at the shared checkout, and the extensions are beside that
   * checkout's parent. Nothing here is a written-down path, so moving the tree does not break it.
   */
  private static mirrorOf(framework: string): string | null {
    try {
      const common = execFileSync('git', ['-C', framework, 'rev-parse', '--git-common-dir'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      const checkout = path.dirname(path.resolve(framework, common));
      return path.resolve(checkout, '..', '..');
    } catch {
      return null;
    }
  }

  /** Where this kind of extension is kept in the mirror, when the mirror has it at all. */
  private get root(): string | null {
    if (!this.mirror) return null;

    const root = path.join(this.mirror, this.kind);
    return fs.existsSync(root) ? root : null;
  }

  /**
   * Every extension the given ones need, transitively.
   *
   * The ones named on the command line come first and keep their place: a dependency that is also
   * being worked on must be the worktree, not the mirror's copy of it.
   */
  resolve(chosen: readonly string[]): ReadonlyMap<string, string> {
    return this.walk(chosen).found;
  }

  /** What is still needed after the mirror has been searched, by the extension that asked for it. */
  missing(chosen: readonly string[]): ReadonlyMap<string, string[]> {
    return this.walk(chosen).missing;
  }

  /**
   * Whether this directory is one the caller named.
   *
   * What the caller named is being worked on and mounts writable; everything the mirror supplied
   * is read-only, because a container must not be able to write into the shared checkouts.
   */
  static chosenAmong(chosen: readonly string[], directory: string): boolean {
    return chosen.some((entry) => path.resolve(entry) === path.resolve(directory));
  }

  /**
   * Whether this directory is the mirror's own copy rather than a worktree.
   *
   * Naming the mirror on the command line does not make it a change: it is still the shared
   * checkout of main, and a container must not write there. It mounts read-only like any
   * dependency, and the caller is told, because a change made in a worktree is not in it.
   */
  isMirrored(directory: string): boolean {
    const root = this.root;
    if (!root) return false;

    const relative = path.relative(root, path.resolve(directory));
    return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  /** One walk of the dependency graph, breadth first, the named extensions winning any tie. */
  private walk(chosen: readonly string[]): StackExtensionWalk {
    const found = new Map<string, string>();
    for (const extension of chosen) found.set(StackExtensions.slugOf(extension), extension);

    const missing = new Map<string, string[]>();
    const queue = [...found.keys()];

    while (queue.length) {
      const slug = queue.shift() as string;
      const directory = found.get(slug);
      if (!directory) continue;

      for (const needed of Object.keys(StackExtensions.dependenciesOf(directory))) {
        if (found.has(needed)) continue;

        const fromMirror = this.lookUp(needed);
        if (fromMirror) {
          found.set(needed, fromMirror);
          queue.push(needed);
          continue;
        }
        missing.set(slug, [...(missing.get(slug) ?? []), needed]);
      }
    }
    return new StackExtensionWalk(found, missing);
  }

  /** The mirror's copy of one extension, by slug — the directory name is not trusted for this. */
  private lookUp(slug: string): string | null {
    const root = this.root;
    if (!root) return null;

    const direct = path.join(root, slug);
    if (fs.existsSync(path.join(direct, 'manifest.json'))) return direct;

    for (const entry of fs.readdirSync(root)) {
      const candidate = path.join(root, entry);
      if (fs.existsSync(path.join(candidate, 'manifest.json')) && StackExtensions.slugOf(candidate) === slug) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * The slug the platform knows an extension by, from its own manifest.
   *
   * NOT the directory name. A worktree is named for the change — `plugin-boxnow`, `ec-page` —
   * while the manifest says `logistics-boxnow`, and the platform looks an extension up by slug.
   * Mounted under the directory name it lands where nothing reads, and the plugin is absent with
   * no error to explain it.
   */
  static slugOf(extension: string): string {
    const manifest = path.join(extension, 'manifest.json');
    if (fs.existsSync(manifest)) {
      const slug = String((JSON.parse(fs.readFileSync(manifest, 'utf8')) as { slug?: string }).slug || '').trim();
      if (slug) return slug;
    }
    return path.basename(extension);
  }

  /** What an extension's manifest says it needs, by slug. */
  private static dependenciesOf(extension: string): Record<string, string> {
    const manifest = path.join(extension, 'manifest.json');
    if (!fs.existsSync(manifest)) return {};

    const declared = (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { dependencies?: Record<string, string> }).dependencies;
    return declared ?? {};
  }
}
