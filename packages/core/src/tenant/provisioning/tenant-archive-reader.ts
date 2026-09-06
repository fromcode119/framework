import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import * as tar from 'tar';
import { TenantArchiveLayout } from '@core/tenant/provisioning/tenant-archive-layout';
import { TenantArchiveManifest } from '@core/tenant/provisioning/tenant-archive-manifest';

/**
 * Opens a tenant archive: extracts it to a private temporary directory, validates the manifest, and
 * hands out its rows one table at a time — lazily, line by line, so the importer's memory is bounded
 * by a page and not by the site.
 *
 * `close()` removes the extraction. Callers use try/finally; a reader left open is a site's data
 * sitting in /tmp.
 */
export class TenantArchiveReader {
  private constructor(readonly root: string, readonly manifest: TenantArchiveManifest) {}

  static async open(archivePath: string): Promise<TenantArchiveReader> {
    if (!fs.existsSync(archivePath)) throw new Error(`Tenant archive not found: ${archivePath}`);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-tenant-import-'));
    try {
      await tar.extract({ file: archivePath, cwd: root });
      const manifestPath = path.join(root, TenantArchiveLayout.MANIFEST);
      if (!fs.existsSync(manifestPath)) throw new Error('This archive is not a tenant archive: it has no manifest.json.');
      const manifest = TenantArchiveManifest.from(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
      return new TenantArchiveReader(root, manifest);
    } catch (error) {
      fs.rmSync(root, { recursive: true, force: true });
      throw error;
    }
  }

  /** Rows of one table, in file order. Yields nothing for a table the archive does not carry. */
  async *rows(table: string): AsyncGenerator<Record<string, unknown>> {
    const file = TenantArchiveLayout.tableFile(this.root, table);
    yield* this.lines(file);
  }

  async *users(): AsyncGenerator<Record<string, unknown>> {
    yield* this.lines(path.join(this.root, TenantArchiveLayout.USERS));
  }

  /** The archived file for a media filename, or null when the archive does not carry it. */
  filePath(name: string): string | null {
    const candidate = path.join(this.root, TenantArchiveLayout.FILES_DIR, path.posix.basename(name));
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : null;
  }

  fileNames(): string[] {
    const dir = path.join(this.root, TenantArchiveLayout.FILES_DIR);
    return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  }

  close(): void {
    fs.rmSync(this.root, { recursive: true, force: true });
  }

  private async *lines(file: string): AsyncGenerator<Record<string, unknown>> {
    if (!fs.existsSync(file)) return;
    const input = fs.createReadStream(file, { encoding: 'utf8' });
    const reader = readline.createInterface({ input, crlfDelay: Infinity });
    try {
      for await (const line of reader) {
        const text = line.trim();
        if (!text) continue;
        yield TenantArchiveReader.revive(JSON.parse(text) as Record<string, unknown>);
      }
    } finally {
      reader.close();
      input.destroy();
    }
  }

  /** Undoes the writer's `portable()`: base64 markers back to Buffers. Dates stay ISO strings — the database parses them. */
  private static revive(row: Record<string, unknown>): Record<string, unknown> {
    for (const key of Object.keys(row)) {
      const value = row[key] as any;
      if (value && typeof value === 'object' && typeof value.$base64 === 'string' && Object.keys(value).length === 1) {
        row[key] = Buffer.from(value.$base64, 'base64');
      }
    }
    return row;
  }
}
