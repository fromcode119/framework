/**
 * The admin's Content-Security-Policy.
 *
 * The console acts with whoever is signed in — a platform administrator included — so a script that
 * gets onto one of its pages acts with those rights. SCRIPT is what this policy decides: only a script
 * carrying this request's nonce runs, and `'strict-dynamic'` lets what those scripts load (the runtime,
 * plugin and appearance bundles) run too. An injected `<script>`, an `onclick=` attribute or a
 * `javascript:` URL runs nowhere. Next stamps the nonce onto its own scripts when it reads this header
 * on the request, which is why every admin page renders per request (`RootLayout.dynamic`).
 *
 * Everything else stays as open as the admin needs — plugin screens load images, fonts and data from
 * anywhere an integration points — except the three things no admin page does: plugins (`object`),
 * a foreign `<base>`, and being framed by another site.
 *
 * Next's dev server evaluates code for Fast Refresh, so `'unsafe-eval'` is added in development only.
 */
export class AdminContentSecurityPolicy {
  static readonly HEADER = 'Content-Security-Policy';

  static nonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes));
  }

  static header(nonce: string, development: boolean): string {
    return [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data: https:",
      "media-src 'self' data: blob: https:",
      "connect-src 'self' https: http: ws: wss:",
      "frame-src 'self' https: http:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ');
  }
}
