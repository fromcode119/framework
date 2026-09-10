import fs from 'node:fs';
import path from 'node:path';
import { FrameworkRoot } from './cli/framework-root';

/**
 * The dependency overrides that exist for SECURITY reasons must still be exactly what was audited.
 *
 * This only VERIFIES. The pinning is npm's job: `overrides` in package.json collapses the tree to one
 * copy of the pinned package, so the vulnerable version is never on disk (monaco-editor 0.56.0 asks for
 * dompurify 3.4.8; the override installs 3.4.15 and no nested copy). What this catches is an override
 * changed or dropped without anyone re-auditing it — a silent downgrade that otherwise surfaces only in
 * the next audit.
 *
 * It used to be a `postinstall` script, which is why it lived outside `packages/` and outside every
 * convention that applies here. Build time is the better gate anyway: the build is what ships.
 */
export class DependencyOverrideGuard {
  /** Overrides that are security-motivated. A plain version pin does not belong here. */
  private static readonly AUDITED: readonly string[] = ['dompurify'];

  static run(): number {
    const root = FrameworkRoot.find();
    const manifest = DependencyOverrideGuard.read(path.join(root, 'package.json'));
    const failures: string[] = [];

    for (const name of DependencyOverrideGuard.AUDITED) {
      // The pin lives in `overrides` and nowhere else, so there is no second copy of the version to
      // drift out of step with it.
      const pinned = manifest?.overrides?.[name];
      if (!pinned) {
        failures.push(`the security override for "${name}" is missing from package.json overrides`);
        continue;
      }

      const installed = DependencyOverrideGuard
        .read(path.join(root, 'node_modules', name, 'package.json'))?.version;
      if (!installed) {
        failures.push(`"${name}" is not installed, so its security override cannot be verified`);
        continue;
      }
      if (installed !== pinned) {
        failures.push(`expected the audited "${name}" ${pinned}, found ${installed}`);
      }
    }

    for (const failure of failures) {
      console.error(`[arch-guard] dependency-overrides: ${failure}.`);
    }
    if (failures.length) {
      console.error('[arch-guard] A security override changed. Re-audit it before changing the pin.');
      return 1;
    }

    console.log(`[arch-guard] dependency-overrides: ${DependencyOverrideGuard.AUDITED.length} audited override(s) intact.`);
    return 0;
  }

  private static read(file: string): any {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }
}
