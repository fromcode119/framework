import http from 'http';
import { Logger } from '@fromcode119/core';

/**
 * The gateway's access log: ONE line per request it answers — host, method, path, status, duration and the
 * upstream that served it (`frontend`, `admin`, `api`, or `gateway` for what it answered itself: a redirect
 * to HTTPS, an unknown host, an edge challenge, a 502). Written through the platform `Logger`
 * (namespace `gateway:http`), so `LOG_LEVEL` governs it like every other line.
 *
 * It is the only log that sees a storefront PAGE request — the api sees only the calls the page makes.
 *
 * The path is the one the visitor asked for, read before routing rewrites it, without the query string
 * (tokens, emails and search terms travel there). A request whose client left before the response ended is
 * logged as `aborted`. A 5xx or an abort is logged at `warn`, everything else at `info`.
 */
export class GatewayAccessLog {
  private static readonly logger = new Logger({ namespace: 'gateway:http' });

  constructor(
    private readonly upstreamOf: (req: http.IncomingMessage) => string | undefined,
    private readonly skip: (url: string) => boolean,
  ) {}

  track(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';
    if (this.skip(url)) return;
    const start = process.hrtime.bigint();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '-').split(',')[0].trim();
    const path = url.split('?')[0];
    // `finish` rather than `writableFinished`: an HTTP/2 response (the TLS listener) has no such property,
    // and both kinds emit `finish` once the whole response is handed to the socket.
    let finished = false;
    res.once('finish', () => { finished = true; });
    res.once('close', () => {
      const ms = Number((process.hrtime.bigint() - start) / 1_000_000n);
      const status = finished ? String(res.statusCode) : 'aborted';
      const line = `${host} ${req.method} ${path} ${status} ${ms}ms upstream=${GatewayAccessLog.serviceName(this.upstreamOf(req))}`;
      if (!finished || res.statusCode >= 500) GatewayAccessLog.logger.warn(line);
      else GatewayAccessLog.logger.info(line);
    });
  }

  /** `http://frontend:3000` → `frontend`; nothing forwarded → `gateway`. */
  private static serviceName(target: string | undefined): string {
    if (!target) return 'gateway';
    try { return new URL(target).hostname; } catch { return target; }
  }
}
