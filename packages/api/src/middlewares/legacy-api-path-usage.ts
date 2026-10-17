import { Logger } from '@fromcode119/core';

/**
 * Who still calls the api at a legacy versioned path (`/api/v1/...`).
 *
 * The alias keeps those addresses working, so nothing breaks and nothing tells anyone they are still in
 * use: an OAuth callback registered with a provider, a webhook URL, an installed app build. This counts
 * each rewritten request by method, path SHAPE, client and referring host, and writes one summary line
 * per caller every interval — enough to name who to update, without a line per request.
 *
 * Nothing identifying is kept: the query string is dropped, and any segment that looks like an id or a
 * token (digits, long hex, a uuid) becomes `:id`, so a share link or a reset token never reaches the log.
 */
export class LegacyApiPathUsage {
  static readonly INTERVAL_MS = 10 * 60 * 1000;
  private static readonly logger = new Logger({ namespace: 'api-legacy-path' });
  private static readonly counts = new Map<string, number>();
  private static timer: NodeJS.Timeout | null = null;

  static record(method: string, legacyPath: string, userAgent: unknown, referer: unknown): void {
    const key = [
      String(method || 'GET').toUpperCase(),
      LegacyApiPathUsage.shape(legacyPath),
      `client=${LegacyApiPathUsage.client(userAgent)}`,
      `from=${LegacyApiPathUsage.host(referer)}`,
    ].join(' ');
    LegacyApiPathUsage.counts.set(key, (LegacyApiPathUsage.counts.get(key) ?? 0) + 1);
    if (!LegacyApiPathUsage.timer) {
      LegacyApiPathUsage.timer = setInterval(() => LegacyApiPathUsage.flush(), LegacyApiPathUsage.INTERVAL_MS);
      LegacyApiPathUsage.timer.unref?.();
    }
  }

  /** One line per caller since the last flush; the lines that were written. */
  static flush(): string[] {
    const lines = [...LegacyApiPathUsage.counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => `${count}x ${key}`);
    LegacyApiPathUsage.counts.clear();
    for (const line of lines) LegacyApiPathUsage.logger.info(`legacy path in use: ${line}`);
    return lines;
  }

  /** `/api/v1/plugins/numerology/share/3f9a…?x=1` → `/api/v1/plugins/numerology/share/:id`. */
  static shape(path: string): string {
    return String(path || '').split('?')[0].split('/').map((segment) => (
      /^\d+$/.test(segment) || /^[0-9a-f]{16,}$/i.test(segment) || /^[0-9a-f-]{32,}$/i.test(segment) ? ':id' : segment
    )).join('/');
  }

  /** The user agent's product token — `Google-…`, `Stripe/1.0`, `okhttp`, `Expo` — or `browser` / `none`. */
  static client(userAgent: unknown): string {
    const ua = String(userAgent ?? '').trim();
    if (!ua) return 'none';
    if (/^Mozilla\//.test(ua)) {
      const bot = ua.match(/\b([A-Za-z-]*(?:bot|Bot|crawler|spider|Google-[A-Za-z-]+)[A-Za-z-]*)\b/);
      return bot ? bot[1] : 'browser';
    }
    return ua.split(/[\s;(]/)[0].slice(0, 40);
  }

  private static host(referer: unknown): string {
    try {
      return new URL(String(referer)).host || 'none';
    } catch {
      return 'none';
    }
  }
}
