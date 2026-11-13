import { Core } from '@extension-builder/core-bridge';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Stamps an extension's integrity checksum into its `manifest.json`. TWICE, and the second time
 * is the one everyone forgets.
 *
 * `pack` stamps the SOURCE dir — right for a plain directory that runs as it is, with its `.ts`
 * files intact. A version-controlled checkout is the exception: core's `IntegrityService` returns
 * its hash and leaves `manifest.json` alone, because a stamp there is a local change to a tracked
 * file on every build. That stamp is WRONG for the tarball: cleaning has just removed
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

  /** For the source tree. Returns the hex digest; written into `manifest.json` unless the tree is a checkout. */
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
