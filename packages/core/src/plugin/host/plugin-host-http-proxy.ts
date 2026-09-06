import http from 'http';
import type { Request, Response, NextFunction } from 'express';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';

/**
 * Forwards one Express request to the guest's Unix socket and streams the answer back.
 *
 * The request the host already parsed is re-sent as JSON; anything it did not parse (multipart, raw
 * bodies) is piped through untouched so a plugin's own multer keeps working. The host's established
 * user and the invocation token travel as private `x-fc-*` headers that the guest strips. A guest that
 * does not answer within the timeout gets a 504 here and is reported to the host, which restarts it.
 */
export class PluginHostHttpProxy {
  constructor(private socketPath: string) {}

  /** A restarted guest may live in a new directory; the next request goes there. */
  retarget(socketPath: string): void {
    this.socketPath = socketPath;
  }

  forward(
    req: Request,
    res: Response,
    next: NextFunction,
    envelope: { token: string; tenantId: string | null; locale: string; targetPath?: string; originalUrl?: string },
    timeoutMs: number,
    onTimeout: () => void,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const headers: Record<string, string | string[] | undefined> = { ...req.headers };
      delete headers.host;
      delete headers.connection;
      delete headers['content-length'];
      delete headers['transfer-encoding'];
      headers[PluginGuestHttp.HEADER_TOKEN] = envelope.token;
      headers[PluginGuestHttp.HEADER_TENANT] = envelope.tenantId ?? '';
      headers[PluginGuestHttp.HEADER_LOCALE] = envelope.locale;
      headers[PluginGuestHttp.HEADER_USER] = (req as any).user ? JSON.stringify((req as any).user) : '';
      if (envelope.originalUrl) headers[PluginGuestHttp.HEADER_ORIGINAL_URL] = envelope.originalUrl;

      // A webhook keeps its ORIGINAL bytes (the host captured `req.rawBody` for webhook paths): re-serialising
      // the parsed JSON would change whitespace and key order and break the provider's signature check.
      const rawBody = (req as any).rawBody;
      const forwardRaw = Buffer.isBuffer(rawBody) && rawBody.length > 0;
      const parsedBody = (req as any).body;
      const sendParsed = !forwardRaw && parsedBody !== undefined && parsedBody !== null && typeof parsedBody === 'object' && !Buffer.isBuffer(parsedBody) && Object.keys(parsedBody).length > 0;
      const serialized = forwardRaw ? rawBody : (sendParsed ? Buffer.from(JSON.stringify(parsedBody)) : null);
      if (serialized) {
        if (forwardRaw) headers[PluginGuestHttp.HEADER_RAW_BODY] = '1';
        else headers['content-type'] = 'application/json';
        headers['content-length'] = String(serialized.length);
      }

      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };

      const upstream = http.request({
        socketPath: this.socketPath,
        method: req.method,
        path: envelope.targetPath ?? req.url,
        headers: headers as http.OutgoingHttpHeaders,
        timeout: timeoutMs,
      }, (reply) => {
        if (reply.headers[PluginGuestHttp.HEADER_NEXT]) {
          reply.resume();
          reply.on('end', () => { finish(); next(); });
          return;
        }
        res.status(reply.statusCode ?? 502);
        for (const [name, value] of Object.entries(reply.headers)) {
          if (value !== undefined && !['connection', 'transfer-encoding', 'keep-alive'].includes(name)) res.setHeader(name, value as string | string[]);
        }
        reply.pipe(res);
        reply.on('end', finish);
        reply.on('error', () => { if (!res.headersSent) res.status(502); res.end(); finish(); });
      });

      upstream.on('timeout', () => {
        upstream.destroy(new Error('guest timeout'));
        if (!res.headersSent) res.status(504).json({ error: 'plugin_timeout', message: 'The plugin did not answer in time and is being restarted.' });
        onTimeout();
        finish();
      });
      upstream.on('error', (error) => {
        if (!res.headersSent) res.status(502).json({ error: 'plugin_unavailable', message: error.message });
        finish();
      });

      if (serialized) {
        upstream.end(serialized);
      } else if (req.readable && !(req as any)._readableState?.ended) {
        req.pipe(upstream);
      } else {
        upstream.end();
      }
    });
  }
}
