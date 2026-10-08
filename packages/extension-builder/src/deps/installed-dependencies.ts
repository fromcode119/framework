import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Whether a package directory's `node_modules` holds what its `package.json` asks for.
 *
 * A build used to install only when `node_modules` was missing, on the premise that it ran on a fresh
 * clone. Sources keeps its checkouts and pulls into them, so a dependency added after a plugin's first
 * build was never installed and the next build failed to resolve it ("Could not resolve
 * \"node-html-parser\""). Instead, every successful install records a fingerprint of what it installed —
 * the dependency names and ranges, without the host-provided `@fromcode119/*` — and a directory whose
 * fingerprint differs (or that has none) is installed again.
 *
 * A build install keeps devDependencies and so also satisfies a production one; the reverse is not true.
 */
export class InstalledDependencies {
  private static readonly STAMP = '.fromcode-installed.json';

  static needsInstall(directory: string, includeDev: boolean): boolean {
    const manifest = InstalledDependencies.manifest(directory);
    if (!manifest) return false;
    const stamp = InstalledDependencies.stamp(directory);
    if (!stamp) return true;
    return stamp[InstalledDependencies.mode(includeDev)] !== InstalledDependencies.fingerprint(manifest, includeDev);
  }

  /** Records what was just installed, so the next build installs only when the manifest changes. */
  static record(directory: string, includeDev: boolean): void {
    const manifest = InstalledDependencies.manifest(directory);
    if (!manifest || !fs.existsSync(path.join(directory, 'node_modules'))) return;
    // A build install also holds everything a production one needs; a production install prunes
    // devDependencies, so it leaves no build install behind.
    const stamp: Record<string, string> = { [InstalledDependencies.mode(false)]: InstalledDependencies.fingerprint(manifest, false) };
    if (includeDev) stamp[InstalledDependencies.mode(true)] = InstalledDependencies.fingerprint(manifest, true);
    fs.writeFileSync(path.join(directory, 'node_modules', InstalledDependencies.STAMP), JSON.stringify(stamp, null, 2));
  }

  private static fingerprint(manifest: Record<string, unknown>, includeDev: boolean): string {
    const fields = ['dependencies', 'optionalDependencies', ...(includeDev ? ['devDependencies'] : [])];
    const wanted = fields.flatMap((field) => Object.entries((manifest[field] ?? {}) as Record<string, string>)
      .filter(([name]) => !name.startsWith('@fromcode119/'))
      .map(([name, range]) => `${field}:${name}@${range}`))
      .sort();
    return createHash('sha256').update(wanted.join('\n')).digest('hex');
  }

  private static mode(includeDev: boolean): string {
    return includeDev ? 'build' : 'production';
  }

  private static manifest(directory: string): Record<string, unknown> | null {
    try {
      return JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    } catch {
      return null;
    }
  }

  private static stamp(directory: string): Record<string, string> | null {
    try {
      return JSON.parse(fs.readFileSync(path.join(directory, 'node_modules', InstalledDependencies.STAMP), 'utf8'));
    } catch {
      return null;
    }
  }
}
