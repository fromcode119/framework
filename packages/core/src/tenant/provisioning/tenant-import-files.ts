import fs from 'fs';
import path from 'path';
import { CoercionUtils } from '@core/utils/coercion-utils';
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

  /**
   * Rewrites every reference to a RENAMED upload, anywhere in a row's values.
   *
   * `rewriteMediaRow` fixes the `media` row that owns the file, but the file's name is also written
   * into CONTENT — a page's blocks hold `/uploads/<name>` directly, and the uploads directory is
   * shared by every site on the platform. Left alone, an imported page keeps pointing at the
   * original name, which now belongs to whichever site uploaded it first: not a broken link, the
   * wrong picture.
   *
   * Only a name this import actually renamed is touched, and only where it stands as a whole
   * filename — bounded on the left by a path/quote/delimiter and not running into a longer name on
   * the right — so a value that merely contains similar text is returned byte-for-byte.
   */
  rewriteUploadReferences(values: Record<string, unknown>): void {
    if (this.renamed.size === 0) return;
    for (const key of Object.keys(values)) {
      values[key] = this.rewriteValue(values[key]);
    }
  }

  private rewriteValue(value: unknown): unknown {
    if (typeof value === 'string') return this.rewriteText(value);
    if (Array.isArray(value)) return value.map((entry) => this.rewriteValue(entry));
    if (value && typeof value === 'object' && !Buffer.isBuffer(value) && !(value instanceof Date)) {
      const walked: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        walked[key] = this.rewriteValue(entry);
      }
      return walked;
    }
    return value;
  }

  private rewriteText(text: string): string {
    let rewritten = text;
    for (const [from, to] of this.renamed) {
      if (!rewritten.includes(from)) continue;
      rewritten = rewritten.replace(TenantImportFiles.boundedName(from), (_match, before: string) => `${before}${to}`);
    }
    return rewritten;
  }

  /** The name as a whole filename: after a path separator, quote or delimiter, and not a prefix of a longer one. */
  private static boundedName(name: string): RegExp {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[/"'(=,\\s])${escaped}(?![A-Za-z0-9._-])`, 'g');
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
