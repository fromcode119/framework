import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StorageDriver } from '../index';

export class LocalStorageDriver implements StorageDriver {
  public readonly provider = 'local';
  constructor(private uploadDir: string, private publicUrlBase: string) {}

  private resolvePublicBasePath(): string {
    const rawBase = String(this.publicUrlBase || '').trim();
    if (!rawBase) return '/uploads';

    if (/^https?:\/\//i.test(rawBase)) {
      try {
        const pathname = new URL(rawBase).pathname || '';
        return pathname.replace(/^\/+|\/+$/g, '');
      } catch {
        return 'uploads';
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
        
    const id = uuidv4();
    const newFilename = `${slugifiedBasename || 'file'}-${id}${ext.toLowerCase()}`;
    const fullPath = path.join(this.uploadDir, newFilename);

    await fs.mkdir(this.uploadDir, { recursive: true });
    
    await fs.writeFile(fullPath, file);

    return newFilename;
  }

  async delete(filepath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filepath);
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
