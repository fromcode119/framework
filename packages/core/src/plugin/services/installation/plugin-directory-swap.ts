import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

/**
 * Replaces an installed plugin directory as a whole.
 *
 * An update used to delete the directory and copy the new files in one by one. For as long as that took,
 * anything reading the directory saw it empty or half-written — and during a rolling deploy a second api
 * boots beside the first: one booted mid-copy, read the old manifest with the new files, failed the
 * integrity check and kept the plugin in error until the next restart, which took a shop down.
 *
 * Now the new content is built in a hidden sibling (scanners skip names starting with "."), then swapped
 * in by rename on the same filesystem. A reader sees the complete old directory or the complete new one.
 */
export class PluginDirectorySwap {
  static async replace(targetDir: string, fill: (stagingDir: string) => Promise<void>): Promise<void> {
    const parent = path.dirname(targetDir);
    const name = path.basename(targetDir);
    const tag = randomBytes(4).toString('hex');
    const staging = path.join(parent, `.${name}.incoming-${tag}`);
    const previous = path.join(parent, `.${name}.previous-${tag}`);
    fs.mkdirSync(staging, { recursive: true });
    try {
      await fill(staging);
    } catch (error) {
      fs.rmSync(staging, { recursive: true, force: true });
      throw error;
    }
    const hadPrevious = fs.existsSync(targetDir);
    if (hadPrevious) fs.renameSync(targetDir, previous);
    try {
      fs.renameSync(staging, targetDir);
    } catch (error) {
      if (hadPrevious) fs.renameSync(previous, targetDir);
      fs.rmSync(staging, { recursive: true, force: true });
      throw error;
    }
    if (hadPrevious) fs.rmSync(previous, { recursive: true, force: true });
  }
}
