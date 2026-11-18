import * as fs from 'fs';
import * as path from 'path';
import { ModuleLocation } from '@extension-builder/module-location';

/**
 * Stamps a packed plugin's `manifest.json` with `engines.core` — the floor it needs = the core it was
 * built against — so the installer and the boot gate can refuse it on an older core (where its UI bundle
 * would fail to import) instead of installing it and breaking. The floor encodes the platform's own
 * release rule: a plugin is built and released only after the core it needs is live, so "needs the core
 * that was live at build" is exactly `>=<build core>`.
 *
 * Only the PACKED copy is touched — never the developer's checked-in manifest, which must stay clean
 * (a stamped checkout is what kept plugin checkouts permanently dirty, framework#1394). A manifest that
 * already declares `engines.core` is left alone: a hand-raised floor is a deliberate "needs at least
 * this". Fails open: when the core version cannot be resolved, nothing is stamped and the plugin installs
 * as before — the boot gate is still the safety net.
 */
export class PluginEnginesStamper {
  static readonly STEP = 'plugin-engines-stamper';

  /** `>=x.y.z` for a readable version, or null when it cannot be parsed (then nothing is stamped). */
  static rangeFor(coreVersion: string): string | null {
    const clean = String(coreVersion || '').trim().replace(/^v/, '');
    return /^\d+\.\d+\.\d+/.test(clean) ? `>=${clean}` : null;
  }

  /**
   * The core version this builder is built against — the SAME value the runtime gate compares a plugin
   * against (SystemUpdateService.installedVersion reads it too), so a stamp and the check speak one
   * scheme. It is the framework ROOT (`@fromcode119/framework`) version: in the monorepo every
   * `packages/*` carries a placeholder `0.0.0`, and only the root is bumped on release, so reading
   * `@fromcode119/core`'s own package.json would stamp a useless `>=0.0.0`. An external plugin repo has
   * no framework root and builds against the published `@fromcode119/sdk`, whose version IS the release.
   * Null when nothing readable is found — then nothing is stamped (fail open).
   */
  static resolveCoreVersion(): string | null {
    const versionFrom = (file: string, wantName?: string): string | null => {
      try {
        if (!fs.existsSync(file)) return null;
        const json = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (wantName && json?.name !== wantName) return null;
        const version = String(json?.version ?? '').trim();
        return /^\d+\.\d+\.\d+/.test(version) && !version.startsWith('0.0.0') ? version : null;
      } catch {
        return null;
      }
    };
    const walkUpForRootNamed = (start: string, name: string): string | null => {
      let dir = start;
      for (let i = 0; i < 12; i++) {
        const found = versionFrom(path.join(dir, 'package.json'), name);
        if (found) return found;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return null;
    };

    // 1. The framework root, walking up from the builder's own location (the monorepo case).
    const fromRoot = walkUpForRootNamed(ModuleLocation.directory, '@fromcode119/framework');
    if (fromRoot) return fromRoot;

    // 2. An external plugin build: the installed SDK's version is the release it builds against.
    try {
      const fromSdkPkg = versionFrom(ModuleLocation.resolve('@fromcode119/sdk/package.json'));
      if (fromSdkPkg) return fromSdkPkg;
    } catch {
      // exports may hide package.json — fall through to walking up from the entry
    }
    try {
      return walkUpForRootNamed(path.dirname(ModuleLocation.resolve('@fromcode119/sdk')), '@fromcode119/sdk');
    } catch {
      return null;
    }
  }

  /** Writes `engines.core` into the packed manifest when it declares none. Returns what it did and why. */
  static stamp(
    packDir: string,
    coreVersion: string | null = PluginEnginesStamper.resolveCoreVersion(),
  ): { stamped: boolean; range?: string; reason?: string } {
    const manifestPath = path.join(packDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return { stamped: false, reason: 'no manifest.json' };
    const range = coreVersion ? PluginEnginesStamper.rangeFor(coreVersion) : null;
    if (!range) return { stamped: false, reason: 'core version could not be resolved' };

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest?.engines?.core) return { stamped: false, reason: 'manifest already declares engines.core' };

    manifest.engines = { ...(manifest.engines || {}), core: range };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return { stamped: true, range };
  }
}
