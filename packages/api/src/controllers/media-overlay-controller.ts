import * as fs from 'fs/promises';
import * as path from 'path';
import { Request, Response } from 'express';
import { Logger, MediaOverlayStore, SystemConstants } from '@fromcode119/core';
import type { IMediaOverlaySpec } from '@fromcode119/core';
import { MediaImageOverlay, MediaManager } from '@fromcode119/media';

/**
 * Serves an image with an extension's overlay (a watermark) laid over it — public, like `/uploads`.
 *
 * The image is made on its first request from the ORIGINAL file and the overlay file named in the
 * extension's stored spec, written to the site's overlay cache, and served from there afterwards. The
 * address carries the spec's hash, so a cached copy can be kept for a year: a changed spec is a
 * different address. An address with an old hash is sent on to the current one.
 */
export class MediaOverlayController {
  private static readonly logger = new Logger({ namespace: 'media-overlay' });
  /** Encoding of the derived file. The size box matches the optimized variant every upload gets. */
  private static readonly OUTPUT = { maxWidth: 1600, maxHeight: 1600, quality: 82 };
  private static readonly IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  /** One make per file at a time: concurrent first requests share it. */
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(private readonly db: any, private readonly mediaManager: MediaManager) {}

  serve = async (req: Request, res: Response): Promise<unknown> => {
    const owner = String(req.params.owner || '');
    const hash = String(req.params.hash || '');
    const match = /^(\d+)\.webp$/.exec(String(req.params.file || ''));
    if (!MediaOverlayStore.isSegment(owner) || !/^[a-f0-9]{16}$/.test(hash) || !match) return res.status(404).end();
    const mediaId = match[1];

    const spec = await new MediaOverlayStore(this.db).read(owner);
    if (!spec || !MediaImageOverlay.isPosition(spec.position)) return res.status(404).end();
    const current = MediaOverlayStore.hash(spec);
    if (current !== hash) {
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, req.originalUrl.replace(`/${hash}/`, `/${current}/`));
    }

    const file = MediaOverlayStore.cacheFile(owner, hash, mediaId);
    try {
      if (!(await MediaOverlayController.exists(file))) await this.makeOnce(file, mediaId, spec);
    } catch (error: unknown) {
      MediaOverlayController.logger.warn(`Overlay for media ${mediaId} (${owner}) not made: ${error instanceof Error ? error.message : String(error)}`);
      return res.status(404).end();
    }
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(file);
  };

  private makeOnce(file: string, mediaId: string, spec: IMediaOverlaySpec): Promise<void> {
    const running = this.inFlight.get(file);
    if (running) return running;
    const job = this.make(file, mediaId, spec).finally(() => this.inFlight.delete(file));
    this.inFlight.set(file, job);
    return job;
  }

  private async make(file: string, mediaId: string, spec: IMediaOverlaySpec): Promise<void> {
    const base = await this.readImage(mediaId);
    const overlay = await this.readImage(spec.overlayMediaId);
    if (!base || !overlay) throw new Error('the image or the overlay is not a public image of this site');
    const composed = await MediaImageOverlay.compose(base, overlay, { ...spec, ...MediaOverlayController.OUTPUT });

    await fs.mkdir(path.dirname(file), { recursive: true });
    // Written beside and renamed, so a reader never sees half a file.
    const partial = `${file}.${process.pid}.${Date.now()}.part`;
    await fs.writeFile(partial, composed.buffer);
    await fs.rename(partial, file);
  }

  /** A public image's original bytes, or null. The row read is tenant-scoped, so another site's id is null. */
  private async readImage(id: string): Promise<Buffer | null> {
    const row = await this.db.findOne(SystemConstants.TABLE.MEDIA, { id: Number(id) });
    if (!row?.path || String(row.visibility || 'public') !== 'public') return null;
    if (!MediaOverlayController.IMAGE_TYPES.includes(String(row.mime_type || ''))) return null;
    const stream = await this.mediaManager.stream(String(row.path));
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer | string>) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  private static async exists(file: string): Promise<boolean> {
    try {
      await fs.access(file);
      return true;
    } catch {
      return false;
    }
  }
}
