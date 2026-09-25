import { RouteConstants } from '@fromcode119/core';

/**
 * Which request paths are inbound webhooks. Two shapes exist: the framework's own `/webhooks/...` and a
 * plugin's `/api/v1/plugins/<slug>/webhooks/...` (a payment provider's callback, a courier's tracking push).
 * Both carry their own signature scheme, so both are exempt from CSRF and keep the raw request bytes for
 * HMAC verification. Matching only the root shape left every plugin webhook 403 "Invalid CSRF token".
 */
export class WebhookRouteUtils {
  static readonly BASE_PATH = RouteConstants.SEGMENTS.WEBHOOKS;
  private static readonly PLUGIN_WEBHOOK_PATTERN = new RegExp(
    `${WebhookRouteUtils.escape(RouteConstants.SEGMENTS.PLUGINS)}/[^/]+${WebhookRouteUtils.escape(RouteConstants.SEGMENTS.WEBHOOKS)}(/|$)`,
  );

  static isWebhookPath(pathname: string): boolean {
    const path = String(pathname || '');
    if (!path) {
      return false;
    }

    if (path === WebhookRouteUtils.BASE_PATH || path.startsWith(`${WebhookRouteUtils.BASE_PATH}/`)) {
      return true;
    }

    return WebhookRouteUtils.PLUGIN_WEBHOOK_PATTERN.test(path);
  }

  /**
   * Body-parser `verify` hook: on a webhook path, keep the request's exact bytes as `req.rawBody` (and the
   * decoded `req.rawBodyString`) — a signature verifier needs the original bytes, not a re-serialisation.
   * Wired into BOTH the JSON and the url-encoded parser: a provider that posts a form (myPOS) signs it
   * too, and without the bytes the plugin proxy re-sent the parsed form as JSON.
   */
  static keepRawBody(req: any, _res: unknown, buf: Buffer, encoding: string): void {
    if (!WebhookRouteUtils.isWebhookPath(String(req?.path || ''))) return;
    req.rawBody = Buffer.from(buf);
    req.rawBodyString = buf.toString((encoding as BufferEncoding) || 'utf8');
  }

  private static escape(segment: string): string {
    return String(segment).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
