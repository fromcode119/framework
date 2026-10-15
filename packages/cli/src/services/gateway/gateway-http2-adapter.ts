import type http from 'http';

/**
 * What an HTTP/2 visitor's request and its answer need to cross an HTTP/1.1 upstream (the
 * frontend, admin and api all speak HTTP/1.1 behind the gateway).
 */
export class GatewayHttp2Adapter {
  /** Connection-level headers HTTP/2 does not allow (RFC 9113 §8.2.2). */
  static readonly HTTP1_ONLY_HEADERS = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade'];

  /**
   * An HTTP/2 request names its host in `:authority`, not `Host`, and carries pseudo-headers
   * (`:method`, `:path`, ...) an HTTP/1.1 upstream refuses. Rewritten in place before routing, so
   * every request reaches routing and the upstream in the same shape however it arrived.
   */
  static fromHttp2(req: http.IncomingMessage): void {
    if (req.httpVersionMajor !== 2) return;
    const headers = req.headers as Record<string, string | string[] | undefined>;
    // `url` and `method` are read FROM `:path` and `:method` on an HTTP/2 request: kept as the
    // request's own values first, or dropping the pseudo-headers would leave it with neither.
    const { url, method } = req;
    Object.defineProperty(req, 'url', { value: url, writable: true, configurable: true });
    Object.defineProperty(req, 'method', { value: method, writable: true, configurable: true });
    if (!headers.host && headers[':authority']) headers.host = String(headers[':authority']);
    for (const name of Object.keys(headers)) if (name.startsWith(':')) delete headers[name];
  }

  /** The upstream's answer made sendable over HTTP/2: its connection-level headers dropped. */
  static toHttp2(proxyRes: http.IncomingMessage, req: http.IncomingMessage): void {
    if (req.httpVersionMajor !== 2) return;
    for (const header of GatewayHttp2Adapter.HTTP1_ONLY_HEADERS) delete proxyRes.headers[header];
  }
}
