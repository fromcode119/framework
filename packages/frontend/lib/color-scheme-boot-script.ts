import { ClientRuntimeConstants } from '@fromcode119/core/client';

/**
 * Pre-paint color-scheme restore for the root layout.
 *
 * `localStorage` is not readable server-side, so the stored light/dark scheme must be
 * re-applied to `<html>` by a SYNCHRONOUS inline script in `<head>`, before first paint —
 * otherwise the SSR shell and the pre-boot page flash the wrong scheme.
 *
 * The browser code is REAL TypeScript ({@link bootstrap}) — type-checked and lintable —
 * not a hand-written JS string. {@link inlineScript} serializes it via
 * `Function.prototype.toString()` and passes the shared contract constants as arguments,
 * so the keys stay single-sourced in {@link ClientRuntimeConstants}.
 *
 * {@link bootstrap} therefore MUST stay self-contained: it may not close over module
 * scope, imports, or `this` — only its own parameters and browser globals survive
 * serialization.
 */
export class ColorSchemeBootScript {
  static bootstrap(storageKey: string, attribute: string): void {
    try {
      const mode = window.localStorage.getItem(storageKey);
      if (mode === 'dark' || mode === 'light') {
        document.documentElement.setAttribute(attribute, mode);
      }
    } catch {
      // Storage blocked (private mode / disabled cookies) — the theme's default scheme stands.
    }
  }

  /**
   * The IIFE for the inline `<script>`. `bootstrap.toString()` yields the method's
   * source in shorthand form (`bootstrap(a, b) { … }`), so it is prefixed with
   * `function` to make it a callable function expression.
   */
  static inlineScript(): string {
    const storageKey = ClientRuntimeConstants.FRONTEND.STORAGE_KEYS.COLOR_SCHEME;
    const attribute = ClientRuntimeConstants.FRONTEND.ATTRIBUTES.COLOR_SCHEME;
    return `(function ${ColorSchemeBootScript.bootstrap.toString()})(${JSON.stringify(storageKey)},${JSON.stringify(attribute)});`;
  }
}
