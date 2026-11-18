import fs from 'fs';
import path from 'path';

/**
 * Where things live, read from what already declares them.
 *
 * Every path this class returns is stated somewhere in the checkout already: the workspace folder
 * in `package.json`, the container paths in the deploy topology's own mounts. Restating them here
 * would be a second copy that goes stale silently — the kind that let the storefront's THEMES_DIR
 * drift between the dev file and the deploy file for months.
 *
 * So nothing here is a literal path. If the framework renames `packages/` or serves the app from
 * somewhere other than `/app`, this follows without an edit.
 */
export class StackLayout {
  /**
   * The one file that marks a deploy directory. It is the same landmark the deploy target uses to
   * find the directory, named once rather than spelled out at each use.
   */
  static readonly TOPOLOGY = 'docker-compose.full-stack.yml';

  static readonly DEPLOY_DIR = 'deploy';

  private constructor(
    /** The workspace folder, e.g. `packages`, from this checkout's own `workspaces` declaration. */
    readonly workspaces: string,
    /** The directory the app is served from inside the container, e.g. `/app`. */
    readonly containerRoot: string,
    /** Where the container expects extensions, keyed by the host folder the topology mounts there. */
    readonly containerExtensionRoots: ReadonlyMap<string, string>,
  ) {}

  static of(framework: string): StackLayout {
    const topology = path.join(framework, StackLayout.DEPLOY_DIR, StackLayout.TOPOLOGY);
    if (!fs.existsSync(topology)) throw new Error(`${framework} has no ${StackLayout.DEPLOY_DIR}/${StackLayout.TOPOLOGY}`);

    const mounts = StackLayout.mountsIn(fs.readFileSync(topology, 'utf8'));
    return new StackLayout(
      StackLayout.workspacesOf(framework),
      StackLayout.rootOf(mounts),
      StackLayout.extensionRootsIn(mounts),
    );
  }

  /** `packages/*` → `packages`. A checkout that declares none is not one this can run. */
  private static workspacesOf(framework: string): string {
    const manifest = path.join(framework, 'package.json');
    if (!fs.existsSync(manifest)) throw new Error(`${framework} has no package.json`);

    const declared = (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { workspaces?: string[] }).workspaces ?? [];
    const first = declared[0];
    if (!first) throw new Error(`${manifest} declares no workspaces, so there is nothing to mount`);

    return first.replace(/\/\*+$/, '');
  }

  /** Every `host:/container` pair the topology states, container side first. */
  private static mountsIn(topology: string): string[] {
    return [...topology.matchAll(/[^\s"']+:(\/[A-Za-z0-9_./-]+)/g)]
      .map((match) => match[1])
      .filter((container) => container.length > 1);
  }

  /**
   * The first segment the most container mounts share.
   *
   * The topology also mounts a few things outside the app (the docker socket, a secrets file), so
   * the answer is the commonest root rather than the only one.
   */
  private static rootOf(mounts: readonly string[]): string {
    const counts = new Map<string, number>();
    for (const mount of mounts) {
      const root = `/${mount.split('/')[1]}`;
      counts.set(root, (counts.get(root) ?? 0) + 1);
    }

    let best = '';
    let seen = 0;
    for (const [root, count] of counts) {
      if (count > seen) [best, seen] = [root, count];
    }
    if (!best) throw new Error('The topology declares no container mounts, so the app root cannot be read from it');

    return best;
  }

  /**
   * The extension roots, as the topology itself mounts them.
   *
   * It states `../plugins:/app/plugins` and `../themes:/app/themes`; the host side names the kind,
   * the container side is where the platform looks for it.
   */
  private static extensionRootsIn(mounts: readonly string[]): ReadonlyMap<string, string> {
    const roots = new Map<string, string>();
    for (const mount of mounts) {
      const segments = mount.split('/').filter(Boolean);
      if (segments.length === 2) roots.set(segments[1], mount);
    }
    return roots;
  }

  /** Where a built workspace package lands inside the container. */
  containerPackage(name: string, output: string): string {
    return `${this.containerRoot}/${this.workspaces}/${name}/${output}`;
  }

  /** Where one extension of a kind lands inside the container, or null when the kind is unknown. */
  containerExtension(kind: string, slug: string): string | null {
    const root = this.containerExtensionRoots.get(kind);
    return root ? `${root}/${slug}` : null;
  }
}
