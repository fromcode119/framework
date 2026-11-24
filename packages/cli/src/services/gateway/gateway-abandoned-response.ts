import type http from 'http';

/**
 * Lets go of the frontend (or admin, or api) when the visitor a request was for has already left.
 *
 * The proxy only stops its request to the app when the VISITOR'S REQUEST is aborted. Over HTTP/2 a GET
 * has already ended its request side by the time it reaches the proxy, so a visitor who cancels the
 * stream (or drops the connection) before the app has answered aborts nothing: the app's answer then
 * arrives for a response that no longer exists, is never read, and holds one of the pool's sockets to
 * that app for as long as the process lives.
 *
 * On 2026-11-24 a scanner requesting backup files on one site cancelled ~450 such requests in twenty
 * minutes, each before the frontend had rendered its 404. Once the pool's 256 sockets to the frontend
 * were all held this way, every page on every site waited for a socket that never came, while the api
 * (its own pool, not touched) kept answering. The gateway held 323 open descriptors; a healthy one ~24.
 *
 * So the moment the visitor's response closes without having finished, the request to the app is
 * destroyed, which returns its socket to nobody and frees the pool's place.
 */
export class GatewayAbandonedResponse {
  private readonly finished = new WeakSet<object>();

  /** Called once the request to the app has a socket — before then there is nothing to free. */
  watch(proxyReq: http.ClientRequest, res: http.ServerResponse): void {
    if (GatewayAbandonedResponse.gone(res)) {
      proxyReq.destroy();
      return;
    }
    res.once('finish', () => this.finished.add(res));
    res.once('close', () => { if (!this.finished.has(res)) proxyReq.destroy(); });
  }

  /**
   * True when the visitor's response can no longer be written: an HTTP/2 stream that was cancelled or
   * whose connection went away, or an HTTP/1.1 response whose connection is gone.
   */
  static gone(res: unknown): boolean {
    const response = res as { stream?: { destroyed?: boolean }; destroyed?: boolean; socket?: { destroyed?: boolean } | null } | null;
    if (!response) return false;
    if (response.stream) return Boolean(response.stream.destroyed);
    return Boolean(response.destroyed || response.socket?.destroyed);
  }
}
