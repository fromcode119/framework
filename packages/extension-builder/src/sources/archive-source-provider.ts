import * as fs from 'fs';
import * as path from 'path';
import type { ISourceProvider } from '@extension-builder/interfaces/source-provider.interfaces';

/**
 * A source that arrives as a `.zip` or `.tar.gz` — the "drag in a plugin, no repo" path.
 *
 * Validation is this provider's own, and it is not the git provider's: an archive's danger is
 * path traversal, not command execution. Extraction itself is core's job (it already installs
 * archives); this provider only proves the file is one we are willing to open.
 */
export class ArchiveSourceProvider implements ISourceProvider {
  static readonly ALLOWED_SUFFIXES = ['.zip', '.tar.gz', '.tgz'];

  readonly kind = 'archive';

  constructor(private readonly input: { archivePath: string; targetDir: string }) {
    ArchiveSourceProvider.assertAllowed(input.archivePath);
  }

  /** Refuses anything that is not a readable file with a suffix we accept. */
  static assertAllowed(archivePath: string): string {
    const value = String(archivePath ?? '').trim();
    if (!value) throw new Error('Archive rejected: no path given.');
    if (!ArchiveSourceProvider.ALLOWED_SUFFIXES.some((suffix) => value.endsWith(suffix))) {
      throw new Error(`Archive rejected: "${value}" must end in ${ArchiveSourceProvider.ALLOWED_SUFFIXES.join(', ')}.`);
    }
    if (!fs.existsSync(value) || !fs.statSync(value).isFile()) {
      throw new Error(`Archive rejected: "${value}" is not a readable file.`);
    }
    return value;
  }

  async resolve(): Promise<string> {
    // The archive is already on disk; the caller extracts it into targetDir through core's
    // installer, which owns entry-path checking. Returning the target keeps the contract uniform.
    fs.mkdirSync(this.input.targetDir, { recursive: true });
    return path.resolve(this.input.targetDir);
  }
}
