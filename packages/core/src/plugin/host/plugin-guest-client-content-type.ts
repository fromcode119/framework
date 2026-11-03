import type { NextFunction, Request, Response } from 'express';

/**
 * The media type the CLIENT declared, carried across the host → guest hop.
 *
 * The host parses a body once and forwards it re-serialised as JSON, writing `content-type:
 * application/json` for those bytes. Without this a plugin answering a form post saw JSON and could
 * never refuse it with 415. The host names the client's type in a private header; the guest takes it
 * off the request before the body parsers run (they must parse the JSON it was sent) and puts it back
 * as `content-type` after them.
 */
export class PluginGuestClientContentType {
  static readonly HEADER = 'x-fc-client-content-type';

  /** Before the private headers are stripped: remember what the host said the client sent. */
  static capture(req: Request): void {
    (req as any).fcClientContentType = String(req.headers[PluginGuestClientContentType.HEADER] ?? '').trim();
  }

  /** After the body parsers: the request carries the media type its client sent, not the one the host wrote. */
  static restore(req: Request, _res: Response, next: NextFunction): void {
    const declared = (req as any).fcClientContentType;
    delete (req as any).fcClientContentType;
    if (declared) req.headers['content-type'] = declared;
    next();
  }
}
