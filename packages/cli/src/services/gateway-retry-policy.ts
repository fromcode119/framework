import type http from 'http';

/**
 * When the gateway may send a failed request to the app again instead of answering 502.
 *
 * During a rolling deploy the old app container is stopped while the new one serves. A request that
 * lands on a kept-alive connection to the old one just as it closes fails before a single byte comes
 * back — nothing reached the app, so nothing happened there. Only then is a retry safe, and only for a
 * request with no body to replay: GET, HEAD, OPTIONS. The retry goes out on a fresh connection, which
 * resolves the app's name again and reaches the container that is still serving.
 */
export class GatewayRetryPolicy {
  static readonly MAX_RETRIES = 2;

  /** Connection-level failures: the app never answered, so the request never took effect. */
  private static readonly RETRYABLE_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ECONNABORTED', 'EAI_AGAIN']);

  private static readonly REPLAYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  private readonly attempts = new WeakMap<http.IncomingMessage, number>();

  /** True when this request may go out once more; counts the attempt when it does. */
  allows(error: NodeJS.ErrnoException, req: http.IncomingMessage, res: unknown): boolean {
    if (!GatewayRetryPolicy.RETRYABLE_CODES.has(String(error?.code ?? ''))) return false;
    if (!GatewayRetryPolicy.REPLAYABLE_METHODS.has(String(req.method ?? 'GET').toUpperCase())) return false;
    // A response already started cannot be taken back; and a socket upgrade (websocket) has no `res`.
    if (!res || typeof (res as http.ServerResponse).writeHead !== 'function' || (res as http.ServerResponse).headersSent) return false;
    const used = this.attempts.get(req) ?? 0;
    if (used >= GatewayRetryPolicy.MAX_RETRIES) return false;
    this.attempts.set(req, used + 1);
    return true;
  }
}
