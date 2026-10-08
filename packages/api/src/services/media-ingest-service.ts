import { randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import { MediaMagicByteValidator, type MediaManager } from '@fromcode119/media';
import { CoercionUtils, NetworkAddressUtils } from '@fromcode119/core';
import type { IMediaIngestInput } from '@api/services/interfaces/media-ingest-input.interface';

/**
 * Store bytes from a URL or base64 as a media record — the ONE path for every caller that is not a
 * browser upload (the MCP media tools, and plugins through `context.media.ingest`).
 *
 * A remote fetch is the dangerous half: the url is caller-supplied, so every hop of a redirect chain
 * is resolved and refused unless ALL its addresses are public (no reaching the metadata service or a
 * private network through the api), credentials in the url are refused, and the body is read under a
 * byte cap rather than trusted to its declared length.
 *
 * Every stored file gets a FRESH filename. The uploads path is served with a 30-day public cache, so
 * reusing a name leaves the edge serving the previous bytes and a replace looks like it did nothing.
 */
export class MediaIngestService {
  /** The admin upload limit, shared with the upload route so the two ways in cannot drift apart. */
  static readonly UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
  private static readonly MAX_REDIRECTS = 3;
  private static readonly FETCH_TIMEOUT_MS = 15_000;

  constructor(
    private readonly db: any,
    private readonly mediaManager: MediaManager,
  ) {}

  /** Store the bytes and write the media row; with `existing`, repoint that row instead. */
  async ingest(input: IMediaIngestInput, maxBytes: number, existing: any = null): Promise<Record<string, unknown>> {
    const bytes = await MediaIngestService.readBytes(input, maxBytes);
    const filename = MediaIngestService.uniqueFilename(MediaIngestService.nameForContent(CoercionUtils.toString(input.filename), bytes));

    const stored = await this.mediaManager.upload(bytes, filename);
    const optimized = await this.mediaManager.createWebPVariant(stored.path).catch(() => null);

    const record = {
      filename,
      originalName: CoercionUtils.toString(input.filename) || filename,
      mimeType: stored.mimeType,
      fileSize: stored.size,
      width: stored.width ?? null,
      height: stored.height ?? null,
      path: stored.path,
      alt: CoercionUtils.toString(input.alt) || existing?.alt || null,
      optimizedPath: optimized?.path ?? null,
      optimizedSize: optimized?.size ?? null,
      optimizedWidth: optimized?.width ?? null,
      optimizedHeight: optimized?.height ?? null,
    };

    // STRING table name, never the declared Schema.media table: that table's `defaultNow()`
    // compiles to Postgres `now()`, which SQLite does not have — the string path routes through the
    // dialect, which owns the timestamps on both databases (same as MediaController).
    // `url` is OUTPUT, not part of the row — it is the address the caller's next step needs.
    const urls = { url: stored.url || this.mediaManager.publicUrl(stored.path) || null, optimizedUrl: optimized?.url ?? null };
    if (existing) {
      await this.db.update('media', { id: existing.id }, record);
      return { id: existing.id, replaced: true, ...record, ...urls };
    }
    const inserted = await this.db.insert('media', record);
    return { id: inserted?.id ?? inserted?.[0]?.id ?? null, replaced: false, ...record, ...urls };
  }

  static async readBytes(input: Pick<IMediaIngestInput, 'base64' | 'sourceUrl'>, maxBytes: number): Promise<Buffer> {
    const base64 = CoercionUtils.toString(input.base64);
    if (base64) {
      const decoded = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
      if (decoded.length > maxBytes) throw new Error(`Media input exceeds the configured ${MediaIngestService.megabytes(maxBytes)} MB limit.`);
      return decoded;
    }

    const sourceUrl = CoercionUtils.toString(input.sourceUrl);
    if (!sourceUrl) throw new Error('Supply either base64 or sourceUrl.');
    return MediaIngestService.fetchRemoteBytes(sourceUrl, maxBytes);
  }

  static async fetchRemoteBytes(sourceUrl: string, maxBytes: number): Promise<Buffer> {
    const limitMessage = `Remote media exceeds the configured ${MediaIngestService.megabytes(maxBytes)} MB limit.`;
    let current = new URL(sourceUrl);
    for (let redirect = 0; redirect <= MediaIngestService.MAX_REDIRECTS; redirect += 1) {
      await MediaIngestService.assertPublicUrl(current);
      const response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(MediaIngestService.FETCH_TIMEOUT_MS),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirect === MediaIngestService.MAX_REDIRECTS) throw new Error('Remote media redirect limit exceeded.');
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) throw new Error(`Could not fetch remote media (${response.status}).`);

      const declaredSize = Number(response.headers.get('content-length') || 0);
      if (declaredSize > maxBytes) throw new Error(limitMessage);
      if (!response.body) return Buffer.alloc(0);

      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error(limitMessage);
        }
        chunks.push(Buffer.from(value));
      }
      return Buffer.concat(chunks, total);
    }
    throw new Error('Remote media redirect limit exceeded.');
  }

  private static async assertPublicUrl(url: URL): Promise<void> {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Remote media URL must use HTTP or HTTPS.');
    if (url.username || url.password) throw new Error('Remote media URL must not contain credentials.');

    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((entry) => !NetworkAddressUtils.isPublic(entry.address))) {
      throw new Error('Remote media URL resolves to a non-public network address.');
    }
  }

  private static megabytes(maxBytes: number): string {
    return String(Math.round((maxBytes / (1024 * 1024)) * 100) / 100);
  }

  /**
   * The name with the extension of what the bytes are, when they are a raster image under ANOTHER
   * raster image's extension. Files fetched from old sites and CDNs are often named for a format they
   * no longer are (a PNG served as `product.jpg`); the upload's signature check rightly refuses that
   * pairing, so the name follows the content instead. Anything else keeps its name, and is checked
   * against it as before.
   */
  static nameForContent(requested: string, bytes: Buffer): string {
    const dot = requested.lastIndexOf('.');
    if (dot <= 0) return requested;
    const ext = requested.slice(dot).toLowerCase();
    if (!MediaMagicByteValidator.canValidate(ext) || MediaMagicByteValidator.matchesExtension(ext, bytes)) return requested;
    const actual = ['.jpg', '.png', '.gif', '.webp'].find((candidate) => MediaMagicByteValidator.matchesExtension(candidate, bytes));
    return actual ? `${requested.slice(0, dot)}${actual}` : requested;
  }

  private static uniqueFilename(requested: string): string {
    const clean = requested.trim() || 'file';
    const dot = clean.lastIndexOf('.');
    const stem = dot > 0 ? clean.slice(0, dot) : clean;
    const ext = dot > 0 ? clean.slice(dot) : '';
    return `${stem}-${randomUUID()}${ext}`;
  }
}
