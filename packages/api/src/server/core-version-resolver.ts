import * as path from 'path';
import * as fs from 'fs';

/**
 * The framework engine version this process is running.
 *
 * Read FRESH on every call rather than captured at boot, so a core update is reflected without
 * restarting — `/health` is how an operator checks what is actually serving.
 *
 * The framework ROOT package (`@fromcode119/framework`) is the canonical version, and now the ONLY
 * package that carries one: workspace packages dropped theirs, because a number stamped into 26
 * files every release described nothing any of them had changed. Matched by NAME, so a stray
 * `package.json` in the working directory cannot masquerade as it.
 */
export class CoreVersionResolver {
  private static readonly ROOT_PACKAGE_NAME = '@fromcode119/framework';

  /** Where the root manifest sits, whether the process was started from the repo or from a package. */
  private static readonly CANDIDATES = ['package.json', '../../package.json'];

  private static read(file: string): { name?: string; version?: string } | null {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {}
    return null;
  }

  /** The engine version, or `0.0.0` when no manifest answers — never a guess at a real number. */
  static resolve(): string {
    for (const candidate of CoreVersionResolver.CANDIDATES) {
      const manifest = CoreVersionResolver.read(path.resolve(process.cwd(), candidate));
      if (manifest?.name === CoreVersionResolver.ROOT_PACKAGE_NAME && manifest.version) return manifest.version;
    }
    return CoreVersionResolver.read(path.resolve(process.cwd(), '../../package.json'))?.version || '0.0.0';
  }
}
