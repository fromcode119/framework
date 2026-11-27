import path from 'path';
import compression from 'compression';
import type { Request, RequestHandler } from 'express';

/**
 * Compressing the uploads that shrink: scripts and other text a client downloads whole.
 *
 * `express.static` sends a file as it lies on disk, so a script bundle an app downloads from `/uploads`
 * crossed the network at more than twice the size it needed to. Chosen by file name, because a bundle has
 * no content type of its own. Pictures, sound, film and archives are compressed already, and a request for
 * a byte range gets exactly the bytes of the file, so neither is touched.
 */
export class UploadsCompression {
  private static readonly EXTENSIONS: ReadonlySet<string> = new Set(['.bundle', '.css', '.js', '.json', '.mjs', '.svg', '.txt']);

  /** Mounted in front of the uploads handler; everything it does not compress passes through untouched. */
  static middleware(): RequestHandler {
    return compression({ filter: (req) => UploadsCompression.applies(req as Request) }) as unknown as RequestHandler;
  }

  private static applies(req: Request): boolean {
    return !req.headers.range && UploadsCompression.EXTENSIONS.has(path.extname(req.path).toLowerCase());
  }
}
