import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

/**
 * Extract a zip archive into `targetDir`, refusing entries that would escape
 * the target directory (zip-slip / path-traversal). `AdmZip.extractAllTo` does
 * not validate this on its own — every caller must use this helper instead.
 */
export class SafeArchive {
  static extractZip(zipPath: string, targetDir: string): void {
    const zip = new AdmZip(zipPath);
    const resolvedTarget = path.resolve(targetDir);

    for (const entry of zip.getEntries()) {
      const entryName = entry.entryName.replace(/\\/g, '/');
      if (entryName.includes('\0')) {
        throw new Error(`Refusing zip entry with NUL byte: ${entryName}`);
      }
      const destPath = path.resolve(resolvedTarget, entryName);
      const isInside =
        destPath === resolvedTarget ||
        destPath.startsWith(resolvedTarget + path.sep);
      if (!isInside) {
        throw new Error(
          `Refusing zip entry that escapes target directory: ${entryName}`
        );
      }

      if (entry.isDirectory) {
        fs.mkdirSync(destPath, { recursive: true });
        continue;
      }
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
    }
  }
}
