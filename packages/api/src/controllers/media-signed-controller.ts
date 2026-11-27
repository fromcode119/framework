import { Request, Response } from 'express';
import { Logger, MediaSignedTokens, MediaVisibility, RequestContextUtils, SystemConstants } from '@fromcode119/core';
import type { IPluginManagerInterface } from '@fromcode119/core';
import { MediaManager } from '@fromcode119/media';
import { MediaByteRange } from '@api/controllers/media-byte-range';

/**
 * One stored file, public or private, to whoever holds a signed link (`context.media.signedUrl`).
 *
 * Public on purpose: the token IS the credential, minted by an extension after it checked the person, and
 * it lasts minutes. Every refusal is the same 404 — a forged, expired or foreign token says nothing about
 * which. A `Range` request is answered in part (206), since a video player reads a file that way.
 */
export class MediaSignedController {
  private static readonly logger = new Logger({ namespace: 'media-signed' });
  private readonly tokens: MediaSignedTokens;

  constructor(private readonly manager: IPluginManagerInterface, private readonly mediaManager: MediaManager) {
    this.tokens = new MediaSignedTokens(manager);
  }

  serve = async (req: Request, res: Response): Promise<unknown> => {
    const tenantId = String((req as unknown as { tenantId?: string }).tenantId || RequestContextUtils.getTenantId() || '').trim() || null;
    let mediaId: string | null = null;
    try {
      mediaId = await this.tokens.verify(String(req.params.token || ''), tenantId);
    } catch {
      // A key that cannot be read means "cannot verify", which must read as no file — never as one.
      mediaId = null;
    }
    if (!mediaId) return res.status(404).end();
    const row: Record<string, any> | null = await this.manager.db.findOne(SystemConstants.TABLE.MEDIA, { id: Number(mediaId) });
    if (!row?.path) return res.status(404).end();

    const size = Number(row.file_size ?? row.fileSize) || 0;
    const range = MediaByteRange.parse(req.headers.range, size);
    if (range === MediaByteRange.UNSATISFIABLE) {
      res.setHeader('Content-Range', `bytes */${size}`);
      return res.status(416).end();
    }
    try {
      const stream = await this.mediaManager.stream(String(row.path), MediaVisibility.resolve(row.visibility).value, range ?? undefined);
      res.setHeader('Content-Type', String(row.mime_type || row.mimeType || 'application/octet-stream'));
      // The link is a capability, and the bytes may not be public: nothing in front of the api keeps them.
      res.setHeader('Cache-Control', 'private, no-store');
      if (size) res.setHeader('Accept-Ranges', 'bytes');
      if (range) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
        res.setHeader('Content-Length', String(range.end - range.start + 1));
      } else if (size) {
        res.setHeader('Content-Length', String(size));
      }
      stream.on('error', (error: any) => {
        MediaSignedController.logger.error(`Signed stream failed for media ${row.id}: ${error?.message}`);
        res.destroy();
      });
      return stream.pipe(res);
    } catch (error: any) {
      MediaSignedController.logger.error(`Could not open media ${row.id}: ${error?.message}`);
      return res.status(404).end();
    }
  };
}
