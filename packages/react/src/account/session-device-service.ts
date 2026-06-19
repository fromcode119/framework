/**
 * Derives a human-friendly "Browser · OS" label from a raw User-Agent string for the account Sessions
 * panel, so a buyer sees "Chrome · macOS" instead of an opaque UA. Returns '' when nothing recognisable
 * is found (the panel then falls back to its "unknown device" copy). Pure string parsing — no i18n,
 * since browser/OS names are proper nouns rendered identically in every locale.
 */
export class AccountSessionDeviceService {
  static label(userAgent: string): string {
    const ua = String(userAgent || '').trim();
    if (!ua) return '';
    const browser = AccountSessionDeviceService.browser(ua);
    const os = AccountSessionDeviceService.os(ua);
    const parts = [browser, os].filter(Boolean);
    if (parts.length) return parts.join(' · ');
    // Non-browser clients (API scripts, server tooling) have no OS token — show the raw token.
    return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
  }

  private static browser(ua: string): string {
    if (/curl\//i.test(ua)) return 'curl';
    if (/^node|nodejs|node-fetch|axios|undici/i.test(ua)) return 'Node.js';
    if (/Electron|Claude/i.test(ua)) return 'Desktop app';
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/OPR\/|Opera/i.test(ua)) return 'Opera';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome';
    if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
    return '';
  }

  private static os(ua: string): string {
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
    if (/Windows NT|Windows/i.test(ua)) return 'Windows';
    if (/Linux/i.test(ua)) return 'Linux';
    return '';
  }
}
