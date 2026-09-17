import fs from 'fs';
import path from 'path';

/**
 * Questions asked of an EXTRACTED archive's directory tree, before anything in it is installed.
 *
 * An uploaded package may be wrapped in a directory (a GitHub tarball always is), so nothing here
 * assumes the manifest or the built output sits at the root — each answer is found by walking.
 */
export class ArchiveTreeInspector {
  /** Where the named manifest actually is, root-first then depth-first, or `null` if absent. */
  static findManifest(rootDir: string, filename: string): string | null {
    const directPath = path.join(rootDir, filename);
    if (fs.existsSync(directPath)) {
      return directPath;
    }

    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const found = ArchiveTreeInspector.findManifest(path.join(rootDir, entry.name), filename);
      if (found) {
        return found;
      }
    }

    return null;
  }

  /** Does a directory with this exact name appear anywhere in the tree? */
  static containsDirectory(rootDir: string, segment: string): boolean {
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name === segment
          || ArchiveTreeInspector.containsDirectory(path.join(rootDir, entry.name), segment)) {
        return true;
      }
    }
    return false;
  }

  /** Does any FILE's path match? Paths are normalised to `/`, so a pattern is written one way only. */
  static containsFile(rootDir: string, pattern: RegExp): boolean {
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        if (ArchiveTreeInspector.containsFile(absolutePath, pattern)) {
          return true;
        }
        continue;
      }

      if (pattern.test(absolutePath.replace(/\\/g, '/'))) {
        return true;
      }
    }
    return false;
  }

  /** How many files the package holds — what the upload summary reports. */
  static countFiles(rootDir: string): number {
    let count = 0;
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        count += ArchiveTreeInspector.countFiles(absolutePath);
      } else if (entry.isFile()) {
        count += 1;
      }
    }
    return count;
  }
}
