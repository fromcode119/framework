import { Core } from '@extension-builder/core-bridge';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Stamps an extension's integrity checksum into its `manifest.json`. TWICE, and the second time
 * is the one everyone forgets.
 *
 * `pack` stamps the SOURCE dir — right for local development, where a plugin runs from the mounted
 * tree with its `.ts` files intact. That stamp is WRONG for the tarball: cleaning has just removed
 * `*.ts`, `tests/`, `scripts/` and friends, so the archive can never hash to the value baked into
 * its own manifest. Every plugin tarball once shipped with a checksum that did not match its own
 * contents, and since the runtime hashes the INSTALLED directory, every production install failed
 * verification and disabled the plugin. An artifact must certify itself.
 *
 * The hash always comes from core's `IntegrityService` — never recomputed here. A second
 * implementation that disagreed by one excluded entry would disable every integrity-checked plugin
 * at its next boot.
 */
export class IntegrityStamper {
  static readonly STEP = 'integrity-stamper';

  /** For the mounted source tree. Returns the hex digest written into `manifest.json`. */
  static async stampSourceDir(dir: string): Promise<string> {
    return IntegrityStamper.stamp(dir);
  }

  /** For the CLEANED pack dir, after `PackCleaner`. Same call — the difference is WHEN. */
  static async stampPackedDir(dir: string): Promise<string> {
    return IntegrityStamper.stamp(dir);
  }

  private static async stamp(dir: string): Promise<string> {
    if (!fs.existsSync(path.join(dir, 'manifest.json'))) return '';
    return Core.IntegrityService.restampPlugin(dir);
  }
}
