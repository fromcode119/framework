import { SystemConstants, ApiVersionUtils, CookieConstants } from '@fromcode119/core/client';
import { ApplicationUrlUtils } from '@fromcode119/core/client';
import { cookies, headers } from 'next/headers';
import { ServerFetchOutcome } from '@/lib/server-fetch-outcome';

import { ServerApiConfig } from '@/lib/server-api/server-api-config';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';
import { ServerApiErrors } from '@/lib/server-api/server-api-errors';

export class ServerApiUtils {

  static extractFirstDoc(result: unknown): unknown {
    if (Array.isArray(result)) return result[0] || null;
    const r = result as Record<string, unknown>;
    if (Array.isArray(r?.docs)) return (r.docs as unknown[])[0] || null;
    return r?.doc || result || null;
  }

  /**
   * Forward the signed-in visitor's framework session cookie (`userToken`) into
   * server-side API fetches so per-request SSR (force-dynamic pages) resolves with
   * the visitor's identity. Without this the API sees every SSR fetch as anonymous,
   * which makes members-only gated pages render the paywall even for entitled members.
   * Safe outside a request scope: `cookies()` throws there and we forward nothing.
   *
   * `forwardOperatorSession` additionally presents the OPERATOR's admin session (`fc_token`, set on
   * the shared cookie domain, so the browser already sends it here) as a Bearer token. It exists for
   * ONE caller: a `?preview=1` resolve. The admin's "Preview" button is a plain navigation to this
   * storefront, and the admin and storefront sessions are deliberately separate cookies — so without
   * this the API sees an anonymous request and, now that a query parameter no longer grants preview,
   * would answer 404 for the operator's own draft. The API's auth middleware accepts a Bearer token
   * on non-admin surfaces, and preview remains gated on that token's roles/permissions
   * (`ContentPreviewAccessUtils`), so forwarding it grants nothing a plain visitor's token would not.
   */
  static async buildForwardedAuthHeaders(
    options: { forwardOperatorSession?: boolean } = {},
  ): Promise<Record<string, string>> {
    try {
      const store = await cookies();
      const forwarded: Record<string, string> = {};
      const token = store.get(CookieConstants.CLIENT_AUTH_TOKEN)?.value;
      if (token) forwarded.cookie = `${CookieConstants.CLIENT_AUTH_TOKEN}=${token}`;

      if (options.forwardOperatorSession) {
        const operatorToken = store.get(CookieConstants.AUTH_TOKEN)?.value;
        if (operatorToken) forwarded.authorization = `Bearer ${operatorToken}`;
      }

      // THE TENANT. A server-to-server fetch reaches the API as `Host: api:3000`, and on a
      // multi-tenant deployment the API routes the storefront by host — so without this every SSR
      // fetch (`/system/frontend`, `/system/resolve`, the page document itself) answered
      // `404 unknown_host` and the storefront rendered an empty shell with a 200. The public host of
      // the INCOMING request is what identifies the customer; `x-forwarded-host` is what the API's
      // tenant router reads first (`RequestTenantService.hostFrom`). Harmless on a single-tenant
      // deployment, where the tenancy middleware passes everything through.
      const incoming = await headers();
      const publicHost = String(incoming.get('x-forwarded-host') || incoming.get('host') || '').split(',')[0].trim();
      if (publicHost) forwarded['x-forwarded-host'] = publicHost;
      const publicProto = String(incoming.get('x-forwarded-proto') || '').split(',')[0].trim();
      if (publicProto) forwarded['x-forwarded-proto'] = publicProto;

      return forwarded;
    } catch {
      // No request scope (e.g. build-time) — nothing to forward.
    }
    return {};
  }

  /**
   * Lenient wrapper: collapses "no such document" and "API unreachable" back into `null`.
   * Only for surfaces that genuinely degrade (theme assets, prefetch hints, i18n dictionary).
   * Anything that decides whether a PAGE exists must use {@link serverFetchJsonOutcome}.
   */
  static async serverFetchJson(path: string): Promise<unknown> {
    return (await ServerApiUtils.serverFetchJsonOutcome(path)).value;
  }

  static async serverFetchJsonOutcome(path: string): Promise<ServerFetchOutcome<unknown>> {
    const requestPath = ServerApiUtils.AdminUrlUtils(path);
    if (!requestPath) {
      if (ServerApiConfig.DEBUG_SERVER_FETCH) {
        console.warn(`[frontend] Skipping fetch due to invalid path: ${String(path)}`);
      }
      return ServerFetchOutcome.resolved<unknown>(null);
    }

    const prefixes = ServerApiPaths.getServerApiPrefixes();
    const forwardedHeaders = await ServerApiUtils.buildForwardedAuthHeaders();
    let lastError: unknown = null;
    let answered = false;

    for (const prefix of prefixes) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ServerApiConfig.SERVER_FETCH_TIMEOUT_MS);
      try {
        const url = /^https?:\/\//i.test(requestPath) ? requestPath : `${prefix}${requestPath}`;
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: forwardedHeaders });
        if (!response.ok) {
          // Only a status that is a real answer (404, 403, …) counts as "the API says there is
          // nothing here". A 429/5xx means it could not serve us — never treat that as absence.
          if (!ServerApiErrors.isUnavailableStatus(response.status)) {
            answered = true;
          } else {
            lastError = new Error(`API responded ${response.status} ${response.statusText}`.trim());
          }
          continue;
        }
        answered = true;
        return ServerFetchOutcome.resolved<unknown>(await response.json());
      } catch (error) {
        ServerApiErrors.rethrowIfControlFlowSignal(error);
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }

    if (answered) return ServerFetchOutcome.resolved<unknown>(null);

    ServerApiErrors.reportTransportFailure('fetch', requestPath, lastError);
    return ServerFetchOutcome.unreachable<unknown>(lastError);
  }

  /** Lenient wrapper — see {@link serverFetchJson}. */
  static async serverFetchResponse(path: string, requestInit?: RequestInit): Promise<Response | null> {
    return (await ServerApiUtils.serverFetchResponseOutcome(path, requestInit)).value;
  }

  static async serverFetchResponseOutcome(
    path: string,
    requestInit?: RequestInit,
    options: { forwardOperatorSession?: boolean } = {},
  ): Promise<ServerFetchOutcome<Response>> {
    const requestPath = ServerApiUtils.AdminUrlUtils(path);
    if (!requestPath) {
      if (ServerApiConfig.DEBUG_SERVER_FETCH) {
        console.warn(`[frontend] Skipping response fetch due to invalid path: ${String(path)}`);
      }
      return ServerFetchOutcome.resolved<Response>(null);
    }

    const prefixes = ServerApiPaths.getServerApiPrefixes();
    const forwardedHeaders = await ServerApiUtils.buildForwardedAuthHeaders(options);
    let lastError: unknown = null;
    let lastResponse: Response | null = null;

    for (const prefix of prefixes) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ServerApiConfig.SERVER_FETCH_TIMEOUT_MS);
      try {
        const url = /^https?:\/\//i.test(requestPath) ? requestPath : `${prefix}${requestPath}`;
        const response = await fetch(url, {
          ...requestInit,
          cache: requestInit?.cache ?? 'no-store',
          signal: controller.signal,
          headers: { ...forwardedHeaders, ...(requestInit?.headers as Record<string, string> | undefined) },
        });
        if (!response.ok) {
          lastResponse = response;
          // A 429/5xx is not an answer about this document — keep looking, and if no prefix ever
          // answers, report unreachable rather than handing back a status callers read as "absent".
          if (ServerApiErrors.isUnavailableStatus(response.status)) {
            lastError = new Error(`API responded ${response.status} ${response.statusText}`.trim());
            lastResponse = null;
          }
          continue;
        }
        return ServerFetchOutcome.resolved<Response>(response);
      } catch (error) {
        ServerApiErrors.rethrowIfControlFlowSignal(error);
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }

    // A non-OK response is still the API answering — hand it back rather than claiming unreachable.
    if (lastResponse) return ServerFetchOutcome.resolved<Response>(lastResponse);

    ServerApiErrors.reportTransportFailure('fetch response', requestPath, lastError);
    return ServerFetchOutcome.unreachable<Response>(lastError);
  }

  /** Lenient wrapper — see {@link serverFetchJson}. */
  static async serverFetchInternalResponse(path: string, requestInit?: RequestInit): Promise<Response | null> {
    return (await ServerApiUtils.serverFetchInternalResponseOutcome(path, requestInit)).value;
  }

  static async serverFetchInternalResponseOutcome(path: string, requestInit?: RequestInit): Promise<ServerFetchOutcome<Response>> {
    const requestPath = ServerApiUtils.AdminUrlUtils(path);
    if (!requestPath) {
      if (ServerApiConfig.DEBUG_SERVER_FETCH) {
        console.warn(`[frontend] Skipping internal response fetch due to invalid path: ${String(path)}`);
      }
      return ServerFetchOutcome.resolved<Response>(null);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ServerApiConfig.SERVER_FETCH_TIMEOUT_MS);

    try {
      const baseUrl = ServerApiPaths.buildInternalApiBaseUrl();
      const normalizedPath = requestPath.startsWith(ApiVersionUtils.prefix())
        ? requestPath
        : `${ApiVersionUtils.prefix()}${requestPath}`;
      // Same forwarded headers as the other two paths. This one bypassed the builder, so the
      // internal fetch — the one `/system/frontend` prefers — carried no host and was the first to 404.
      const forwardedHeaders = await ServerApiUtils.buildForwardedAuthHeaders();
      const response = await fetch(`${baseUrl}${normalizedPath}`, {
        ...requestInit,
        cache: requestInit?.cache ?? 'no-store',
        signal: controller.signal,
        headers: { ...forwardedHeaders, ...(requestInit?.headers as Record<string, string> | undefined) },
      });
      return ServerFetchOutcome.resolved<Response>(response);
    } catch (error) {
      ServerApiErrors.rethrowIfControlFlowSignal(error);
      ServerApiErrors.reportTransportFailure('internal response fetch', requestPath, error);
      return ServerFetchOutcome.unreachable<Response>(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private static AdminUrlUtils(path: unknown): string | null {
    if (typeof path !== 'string') return null;
    const normalized = path.trim();
    if (!normalized || normalized === 'undefined' || normalized === 'null') return null;
    return normalized;
  }
}
