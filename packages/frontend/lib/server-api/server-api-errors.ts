import { SystemConstants, ApiVersionUtils, CookieConstants } from '@fromcode119/core/client';
import { ApplicationUrlUtils } from '@fromcode119/core/client';
import { cookies, headers } from 'next/headers';
import { ServerFetchOutcome } from '@/lib/server-fetch-outcome';

/**
 * Classifying what went wrong with a server fetch — an abort, an unavailable upstream, or Next's own
 * control-flow signals, which must be rethrown rather than swallowed.
 *
 * Split out of ServerApiUtils (431 lines) 2026-09-09.
 */
import { ServerApiConfig } from '@/lib/server-api/server-api-config';

export class ServerApiErrors {

  // --- Private helpers ---

  static isAbortError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const value = error as { name?: string; code?: string };
    return value.name === 'AbortError' || value.code === 'ABORT_ERR';
  }


  /**
   * Next signals control flow by THROWING out of `fetch` — `DynamicServerError`
   * (`digest: 'DYNAMIC_SERVER_USAGE'`) during a static prerender, and the `NEXT_*` digests used by
   * `redirect()` / `notFound()`. Those are not transport failures and must reach Next untouched:
   * swallowing the bailout is what let build-time prerenders capture an empty config, and wrapping
   * it fails the build outright. Re-thrown before any outcome is built.
   */
  /**
   * Statuses that mean "the API could not serve this request", NOT "there is no such document".
   * A 429 or a 5xx says nothing about whether the page exists, so it must never be rendered as a
   * 404 — that asks crawlers to delist a live page because the API was busy. Verified live: a
   * per-IP rate limiter throttling the SSR container turned every published page into a hard 404,
   * because all server-side traffic shares one source IP.
   *
   * 4xx codes that ARE genuine answers (400, 401, 403, 404, 410) are deliberately absent.
   */
  static readonly UNAVAILABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);


  static isUnavailableStatus(status: number): boolean {
    return ServerApiErrors.UNAVAILABLE_STATUSES.has(status);
  }


  static rethrowIfControlFlowSignal(error: unknown): void {
    if (!error || typeof error !== 'object') return;
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest !== 'string') return;
    if (digest === 'DYNAMIC_SERVER_USAGE' || digest.startsWith('NEXT_')) throw error;
  }


  /**
   * One place that logs a transport failure, so every fetch helper reports it identically and
   * an unreachable API is never silently swallowed.
   */
  static reportTransportFailure(kind: string, requestPath: string, error: unknown): void {
    if (ServerApiErrors.isAbortError(error)) {
      console.error(`[frontend] Timed out on ${kind} ${requestPath} after ${ServerApiConfig.SERVER_FETCH_TIMEOUT_MS}ms`);
      return;
    }
    console.error(`[frontend] Failed ${kind} ${requestPath}: ${ServerApiErrors.describeError(error)}`);
  }


  /**
   * `TypeError: fetch failed` on its own says nothing — undici puts the real reason
   * (`EAI_AGAIN`, `ECONNRESET`, `UND_ERR_CONNECT_TIMEOUT`, …) on `error.cause`. Omitting the
   * cause is exactly what hid a dead API prefix behind an anonymous "fetch failed" for so long.
   */
  static describeError(error: unknown): string {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (!(error instanceof Error)) return String(error);

    const cause = (error as Error & { cause?: unknown }).cause;
    const causeText = ServerApiErrors.describeCause(cause);
    return causeText ? `${error.name}: ${error.message} (cause: ${causeText})` : `${error.name}: ${error.message}`;
  }


  static describeCause(cause: unknown): string {
    if (!cause) return '';
    if (typeof cause === 'string') return cause;
    const detail = cause as { code?: string; name?: string; message?: string };
    return [detail.code, detail.name, detail.message].filter(Boolean).join(' ').trim();
  }
}
