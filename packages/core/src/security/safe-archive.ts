import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

/**
 * Extract a zip archive into `targetDir`, refusing entries that would escape
 * the target directory (zip-slip / path-traversal). `AdmZip.extractAllTo` does
 * not validate this on its own — every caller must use this helper instead.
 *
 * `maxBytes`, when given, bounds what the archive may unpack to: checked against the sizes the entries
 * declare before anything is written, and against the bytes actually written, so a small upload
 * cannot expand to fill the disk every site shares.
 */
export class SafeArchive {
  static extractZip(zipPath: string, targetDir: string, maxBytes?: number): void {
    const zip = new AdmZip(zipPath);
    const resolvedTarget = path.resolve(targetDir);
    const entries = zip.getEntries();
    if (maxBytes && entries.reduce((total, entry) => total + Number(entry.header.size || 0), 0) > maxBytes) {
      throw new Error(`The archive unpacks to more than the ${SafeArchive.megabytes(maxBytes)} MB allowed.`);
    }
    let written = 0;

    for (const entry of entries) {
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
      const data = entry.getData();
      written += data.length;
      if (maxBytes && written > maxBytes) {
        throw new Error(`The archive unpacks to more than the ${SafeArchive.megabytes(maxBytes)} MB allowed.`);
      }
      fs.writeFileSync(destPath, data);
    }
  }

  private static megabytes(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(1);
  }
}
