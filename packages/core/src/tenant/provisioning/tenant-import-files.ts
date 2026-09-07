import fs from 'fs';
import path from 'path';
import { CoercionUtils } from '@core/coercion-utils';
import { TenantArchiveReader } from '@core/tenant/provisioning/tenant-archive-reader';

/**
 * Puts an archive's files into the uploads directory and remembers any that had to be renamed.
 *
 * Uploads are flat on disk, so a file name from another site can already be taken here. The
 * archived file is then stored as `<name>-<tenantId><ext>` and the `media` row that pointed at it is
 * rewritten to match (`path` keeps its `/uploads/` prefix, `optimized_path` stays a bare filename).
 * Nothing is overwritten: an existing file belongs to some other tenant.
 */
export class TenantImportFiles {
  private readonly renamed = new Map<string, string>();

  constructor(private readonly uploadsDir: string) {}

  run(reader: TenantArchiveReader, tenantId: string, warnings: string[]): TenantImportFiles {
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    for (const name of reader.fileNames()) {
      const from = reader.filePath(name);
      if (!from) continue;
      const target = this.freeName(name, tenantId);
      if (target !== name) this.renamed.set(name, target);
      fs.copyFileSync(from, path.join(this.uploadsDir, target));
    }
    if (this.renamed.size > 0) warnings.push(`${this.renamed.size} file(s) were stored under a suffixed name because the original name was taken.`);
    return this;
  }

  /** Rewrites `path` / `optimized_path` of a media row whose file was renamed. */
  rewriteMediaRow(values: Record<string, unknown>): void {
    for (const key of ['path', 'optimized_path']) {
      const raw = CoercionUtils.toString(values[key]);
      if (!raw) continue;
      const name = path.posix.basename(raw);
      const renamed = this.renamed.get(name);
      if (!renamed) continue;
      values[key] = raw.slice(0, raw.length - name.length) + renamed;
    }
  }

  get renamedCount(): number {
    return this.renamed.size;
  }

  private freeName(name: string, tenantId: string): string {
    if (!fs.existsSync(path.join(this.uploadsDir, name))) return name;
    const ext = path.extname(name);
    const base = name.slice(0, name.length - ext.length);
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const candidate = `${base}-${tenantId}${attempt === 0 ? '' : `-${attempt}`}${ext}`;
      if (!fs.existsSync(path.join(this.uploadsDir, candidate))) return candidate;
    }
    throw new Error(`Could not find a free file name for "${name}".`);
  }
}
