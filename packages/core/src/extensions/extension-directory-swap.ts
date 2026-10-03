import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

/**
 * Replaces an installed plugin, theme or appearance directory as a whole.
 *
 * An update used to delete the directory and copy the new files in one by one. For as long as that took,
 * anything reading the directory saw it empty or half-written — and during a rolling deploy a second api
 * boots beside the first: one booted mid-copy, read the old manifest with the new files, failed the
 * integrity check and kept the plugin in error until the next restart, which took a shop down.
 *
 * Now the new content is built in a hidden sibling (scanners skip names starting with "."), then swapped
 * in by rename on the same filesystem. A reader sees the complete old directory or the complete new one.
 */
export class ExtensionDirectorySwap {
  static async replace(targetDir: string, fill: (stagingDir: string) => Promise<void>): Promise<void> {
    const swap = ExtensionDirectorySwap.stage(targetDir);
    try {
      await fill(swap.staging);
    } catch (error) {
      fs.rmSync(swap.staging, { recursive: true, force: true });
      throw error;
    }
    ExtensionDirectorySwap.commit(targetDir, swap);
  }

  /** The same, for an installer that fills the directory synchronously. */
  static replaceSync(targetDir: string, fill: (stagingDir: string) => void): void {
    const swap = ExtensionDirectorySwap.stage(targetDir);
    try {
      fill(swap.staging);
    } catch (error) {
      fs.rmSync(swap.staging, { recursive: true, force: true });
      throw error;
    }
    ExtensionDirectorySwap.commit(targetDir, swap);
  }

  private static stage(targetDir: string): { staging: string; previous: string } {
    const parent = path.dirname(targetDir);
    const name = path.basename(targetDir);
    const tag = randomBytes(4).toString('hex');
    const staging = path.join(parent, `.${name}.incoming-${tag}`);
    fs.mkdirSync(staging, { recursive: true });
    return { staging, previous: path.join(parent, `.${name}.previous-${tag}`) };
  }

  private static commit(targetDir: string, swap: { staging: string; previous: string }): void {
    const hadPrevious = fs.existsSync(targetDir);
    if (hadPrevious) fs.renameSync(targetDir, swap.previous);
    try {
      fs.renameSync(swap.staging, targetDir);
    } catch (error) {
      if (hadPrevious) fs.renameSync(swap.previous, targetDir);
      fs.rmSync(swap.staging, { recursive: true, force: true });
      throw error;
    }
    if (hadPrevious) fs.rmSync(swap.previous, { recursive: true, force: true });
  }
}
