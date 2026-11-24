import fs from 'fs';
import path from 'path';
import type { StackLayout } from '@cli/services/stack/stack-layout';

/**
 * The worktree's compiled packages and its root manifest, as mounts over a released image.
 *
 * `dist` rather than `src`: the containers run the released image, which starts compiled output.
 * Mounting sources over it would change nothing, which is the kind of "verified" that is worse than not
 * checking at all. Only packages this worktree has BUILT are mounted — an empty host directory would hide
 * the image's own copy.
 */
export class StackPackageMounts {
  /** A compiled workspace package serves this. */
  static readonly OUTPUT = 'dist';
  /** The root manifest: the one file that says which version of the platform is running. */
  private static readonly ROOT_MANIFEST = 'package.json';

  constructor(private readonly framework: string, private readonly layout: StackLayout) {}

  /** The workspace folder of this worktree, as its own package.json declares it. */
  get workspaces(): string {
    return path.join(this.framework, this.layout.workspaces);
  }

  mounts(): string[] {
    const mounts = this.built().map((pkg) => `${path.join(this.workspaces, pkg, StackPackageMounts.OUTPUT)}:${this.layout.containerPackage(pkg, StackPackageMounts.OUTPUT)}`);
    return [...mounts, ...this.versionMount()];
  }

  /** Every workspace package this worktree has actually built. */
  private built(): string[] {
    if (!fs.existsSync(this.workspaces)) return [];
    return fs.readdirSync(this.workspaces).filter((name) => fs.existsSync(path.join(this.workspaces, name, StackPackageMounts.OUTPUT))).sort();
  }

  /**
   * The worktree's root manifest over the image's. The platform reads its own version from that file;
   * without this the containers run the worktree's code and report the IMAGE's version, so every plugin
   * needing a newer core is held as "needs a newer platform" on a stack running exactly that core.
   * Read-only: a container must never rewrite a worktree's manifest.
   */
  private versionMount(): string[] {
    const host = path.join(this.framework, StackPackageMounts.ROOT_MANIFEST);
    return fs.existsSync(host) ? [`${host}:${this.layout.containerRoot}/${StackPackageMounts.ROOT_MANIFEST}:ro`] : [];
  }
}
