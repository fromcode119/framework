import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import type { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { IStorageDriver } from '@media/index';
import { MediaStorageConstants } from '@media/constants/media-storage.constants';

export class LocalStorageDriver implements IStorageDriver {
  public readonly provider = 'local';
  constructor(private uploadDir: string, private publicUrlBase: string) {}

  /**
   * The public path segment files are served under, with no surrounding slashes.
   *
   * Both fallbacks come from ONE constant now. They used to be separate literals that disagreed —
   * `/uploads` when no base was configured, `uploads` when the configured base failed to parse — so the
   * result depended on which way it went wrong.
   */
  private resolvePublicBasePath(): string {
    const rawBase = String(this.publicUrlBase || '').trim();
    if (!rawBase) return MediaStorageConstants.DEFAULT_PUBLIC_SEGMENT;

    if (/^https?:\/\//i.test(rawBase)) {
      try {
        const pathname = new URL(rawBase).pathname || '';
        return pathname.replace(/^\/+|\/+$/g, '');
      } catch {
        return MediaStorageConstants.DEFAULT_PUBLIC_SEGMENT;
      }
    }

    return rawBase.replace(/^\/+|\/+$/g, '');
  }

  private normalizePublicFilePath(filepath: string): string {
    const rawPath = String(filepath || '').trim();
    if (!rawPath) return '';

    let normalized = rawPath;
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // Keep original path if decode fails.
    }

    normalized = normalized.replace(/\\/g, '/').replace(/^\/+/, '');
    const publicBasePath = this.resolvePublicBasePath();

    if (publicBasePath && normalized.startsWith(`${publicBasePath}/`)) {
      normalized = normalized.slice(publicBasePath.length + 1);
    } else if (publicBasePath && normalized === publicBasePath) {
      normalized = '';
    }

    return normalized;
  }

  async save(file: Buffer, filename: string, options?: any): Promise<string> {
    const ext = path.extname(filename);
    const rawBasename = path.basename(filename, ext);
    // Sanitize filename to avoid issues with spaces or special characters on disk
    const slugifiedBasename = rawBasename
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
        
    const id = randomUUID();
    const newFilename = `${slugifiedBasename || 'file'}-${id}${ext.toLowerCase()}`;
    const fullPath = path.join(this.uploadDir, newFilename);

    await fs.mkdir(this.uploadDir, { recursive: true });
    
    await fs.writeFile(fullPath, file);

    return newFilename;
  }

  async read(filepath: string): Promise<Buffer> {
    const fullPath = path.join(this.uploadDir, this.normalizePublicFilePath(filepath));
    return fs.readFile(fullPath);
  }

  /**
   * Resolves inside `uploadDir` or throws. `normalizePublicFilePath` strips leading slashes but does
   * nothing about `..`, so a stored path is the only thing standing between a caller and the rest of
   * the filesystem. That is acceptable for `read`, whose one caller passes a path it just wrote; it is
   * not acceptable for the private-file route, which exists to serve bytes to strangers.
   */
  private resolveContainedPath(filepath: string): string {
    const root = path.resolve(this.uploadDir);
    const fullPath = path.resolve(root, this.normalizePublicFilePath(filepath));
    const isContained = fullPath === root || fullPath.startsWith(`${root}${path.sep}`);
    if (!isContained) throw new Error('Resolved path escapes the storage directory');
    return fullPath;
  }

  async stream(filepath: string): Promise<Readable> {
    const fullPath = this.resolveContainedPath(filepath);
    // stat first: createReadStream reports a missing file asynchronously on the stream, by which point
    // the caller has usually already committed response headers.
    await fs.access(fullPath);
    return createReadStream(fullPath);
  }

  async delete(filepath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, this.normalizePublicFilePath(filepath));
    await fs.unlink(fullPath);
  }

  getUrl(filepath: string): string {
    const base = String(this.publicUrlBase || '').trim().replace(/\/+$/, '');
    const normalizedPath = this.normalizePublicFilePath(filepath);

    if (!normalizedPath) return base;

    const encodedPath = normalizedPath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `${base}/${encodedPath}`;
  }
}
